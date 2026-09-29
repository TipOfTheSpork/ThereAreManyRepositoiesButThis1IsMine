import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { fingerprint, normalizePhoto } from "./image.js";
import { OracleRefusedError, type OracleResult } from "./oracle.js";
import type { ReadingResponse } from "./schema.js";
import { ReadingStore } from "./store.js";

const ReadingRequest = z.object({
  /** Base64-encoded JPEG, PNG, WebP or HEIC photo. */
  image: z.string().min(1),
});

const DeviceId = z.string().min(8).max(128);

export interface AppDeps {
  readFoam: (jpegBase64: string) => Promise<OracleResult>;
  store?: ReadingStore;
  /** Readings per IP address per hour; each one costs an API call. */
  hourlyLimit?: number;
}

export function createApp({ readFoam, store = new ReadingStore(), hourlyLimit = 20 }: AppDeps) {
  const app = express();
  // Behind a hosting provider's load balancer, set TRUST_PROXY=1 so rate limits see the real client IP.
  if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY));
  app.use(express.json({ limit: "12mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post(
    "/api/readings",
    // Keyed by IP, not device ID: a client can make up a new device ID for every request.
    rateLimit({
      windowMs: 60 * 60 * 1000,
      limit: hourlyLimit,
      message: { error: "The oracle needs a rest. Try again in a little while." },
    }),
    async (req, res) => {
      const deviceId = DeviceId.safeParse(req.get("x-device-id"));
      const body = ReadingRequest.safeParse(req.body);
      if (!deviceId.success || !body.success) {
        res.status(400).json({ error: "Send a photo as { image: <base64> } with an X-Device-Id header." });
        return;
      }

      let photo: Buffer;
      try {
        photo = await normalizePhoto(Buffer.from(body.data.image, "base64"));
      } catch {
        res.status(400).json({ error: "That file doesn't look like a photo." });
        return;
      }

      const fp = await fingerprint(photo);
      const previous = store.findRepeat(deviceId.data, fp);
      if (previous) {
        res.json({ ...previous, repeat: true } satisfies ReadingResponse);
        return;
      }

      try {
        const result = await readFoam(photo.toString("base64"));
        const response: ReadingResponse = {
          id: randomUUID(),
          createdAt: new Date().toISOString(),
          repeat: false,
          glasses: result.glasses,
          message: result.message,
        };
        // Only remember photos that produced a reading, so a rejected photo can be retaken.
        if (result.glasses.some((g) => g.reading)) store.save(deviceId.data, fp, response);
        res.json(response);
      } catch (error) {
        if (error instanceof OracleRefusedError) {
          res.status(422).json({ error: "The oracle won't read this one. Try another photo." });
        } else if (error instanceof Anthropic.RateLimitError) {
          res.status(503).json({ error: "The oracle is busy. Try again in a minute." });
        } else {
          console.error("Reading failed:", error);
          res.status(502).json({ error: "The oracle couldn't be reached. Try again." });
        }
      }
    },
  );

  return app;
}
