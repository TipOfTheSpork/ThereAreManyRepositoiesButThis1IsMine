import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.ts";
import { fingerprint, hammingDistance } from "../src/image.ts";
import { enforceRules } from "../src/oracle.ts";
import type { Analysis, Glass } from "../src/schema.ts";
import { READING_TTL_MS, ReadingStore } from "../src/store.ts";

const reading: NonNullable<Glass["reading"]> = {
  headline: "A lively afternoon",
  timeline: [
    { hours: "0-3", prediction: "A friend calls", foam_sign: "tight lacing" },
    { hours: "3-6", prediction: "You find a coin", foam_sign: "coin-shaped bubble" },
    { hours: "6-9", prediction: "A good song", foam_sign: "ripples" },
    { hours: "9-12", prediction: "Deep sleep", foam_sign: "settling head" },
  ],
  lucky_thing: "a blue pen",
  beware: "a squeaky door",
};

function glass(overrides: Partial<Glass> = {}): Glass {
  return {
    position: "center",
    vessel: "pint",
    beer_evidence: "amber, carbonated, creamy head",
    is_beer: true,
    beer_confidence: 0.95,
    style_guess: "pale ale",
    foam: { head_thickness: "medium", bubble_size: "fine", density: "creamy", lacing: "rings", shapes_seen: [] },
    reading,
    ...overrides,
  };
}

function analysis(glasses: Glass[], isRealPhoto = true): Analysis {
  return { is_real_photo: isRealPhoto, glasses, message_if_no_beer: "" };
}

/** Horizontal gradient; `flip` reverses it so the fingerprint differs. */
async function photo(flip = false): Promise<Buffer> {
  const width = 64;
  const pixels = Buffer.alloc(width * width * 3);
  for (let y = 0; y < width; y++)
    for (let x = 0; x < width; x++) pixels.fill(flip ? 255 - x * 4 : x * 4, (y * width + x) * 3, (y * width + x) * 3 + 3);
  return sharp(pixels, { raw: { width, height: width, channels: 3 } }).png().toBuffer();
}

describe("enforceRules", () => {
  it("drops readings for glasses below the confidence threshold", () => {
    const result = enforceRules(analysis([glass(), glass({ beer_confidence: 0.6 })]));
    expect(result.glasses[0].reading).not.toBeNull();
    expect(result.glasses[1].reading).toBeNull();
    expect(result.message).toBeNull();
  });

  it("drops readings for glasses that aren't beer", () => {
    const result = enforceRules(analysis([glass({ is_beer: false })]));
    expect(result.glasses[0].reading).toBeNull();
    expect(result.message).toMatch(/couldn't find a glass of beer/);
  });

  it("refuses photos of screens", () => {
    const result = enforceRules(analysis([glass()], false));
    expect(result.glasses[0].reading).toBeNull();
    expect(result.message).toMatch(/screen/);
  });
});

describe("fingerprint", () => {
  it("matches the same photo and separates different ones", async () => {
    const a = await fingerprint(await photo());
    expect(hammingDistance(a, await fingerprint(await photo()))).toBe(0);
    expect(hammingDistance(a, await fingerprint(await photo(true)))).toBeGreaterThan(10);
  });
});

describe("ReadingStore", () => {
  it("forgets readings after 12 hours", () => {
    let now = 0;
    const store = new ReadingStore(() => now);
    store.save("device-1234", 1n, {} as never);
    expect(store.findRepeat("device-1234", 1n)).not.toBeNull();
    expect(store.findRepeat("device-5678", 1n)).toBeNull();
    now = READING_TTL_MS + 1;
    expect(store.findRepeat("device-1234", 1n)).toBeNull();
  });
});

describe("POST /api/readings", () => {
  let close = () => {};
  afterEach(() => close());

  async function start(readFoam = vi.fn(async () => enforceRules(analysis([glass()]))), hourlyLimit = 20) {
    const server = createApp({ readFoam, hourlyLimit }).listen(0);
    close = () => server.close();
    const { port } = server.address() as AddressInfo;
    const post = async (image: Buffer | string, deviceId = "device-1234") =>
      fetch(`http://localhost:${port}/api/readings`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({ image: typeof image === "string" ? image : image.toString("base64") }),
      });
    return { post, readFoam };
  }

  it("returns a reading, then flags the same photo as a repeat without calling Claude again", async () => {
    const { post, readFoam } = await start();
    const first = await (await post(await photo())).json();
    expect(first.repeat).toBe(false);
    expect(first.glasses[0].reading.headline).toBe("A lively afternoon");

    const second = await (await post(await photo())).json();
    expect(second.repeat).toBe(true);
    expect(second.id).toBe(first.id);
    expect(readFoam).toHaveBeenCalledTimes(1);

    await post(await photo(true));
    expect(readFoam).toHaveBeenCalledTimes(2);
  });

  it("lets another device read the same photo", async () => {
    const { post, readFoam } = await start();
    await post(await photo(), "device-aaaa");
    const other = await (await post(await photo(), "device-bbbb")).json();
    expect(other.repeat).toBe(false);
    expect(readFoam).toHaveBeenCalledTimes(2);
  });

  it("doesn't remember photos that got no reading", async () => {
    const { post, readFoam } = await start(vi.fn(async () => enforceRules(analysis([glass({ is_beer: false })]))));
    await post(await photo());
    const again = await (await post(await photo())).json();
    expect(again.repeat).toBe(false);
    expect(readFoam).toHaveBeenCalledTimes(2);
  });

  it("rejects things that aren't images", async () => {
    const { post, readFoam } = await start();
    const res = await post(Buffer.from("definitely not a photo").toString("base64"));
    expect(res.status).toBe(400);
    expect(readFoam).not.toHaveBeenCalled();
  });

  it("rate-limits by IP even when the device ID changes", async () => {
    const { post } = await start(undefined, 2);
    expect((await post(await photo(), "device-aaaa")).status).toBe(200);
    expect((await post(await photo(true), "device-bbbb")).status).toBe(200);
    expect((await post(await photo(), "device-cccc")).status).toBe(429);
  });

  it("requires a device id", async () => {
    const { post } = await start();
    expect((await post(await photo(), "")).status).toBe(400);
  });
});
