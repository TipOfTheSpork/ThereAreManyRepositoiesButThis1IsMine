import { hammingDistance } from "./image.js";
import type { ReadingResponse } from "./schema.js";

/** A reading covers 12 hours, so the same glass can't be re-read within that window. */
export const READING_TTL_MS = 12 * 60 * 60 * 1000;

/** Fingerprints this close (out of 64 bits) count as the same photo. */
export const REPEAT_DISTANCE = 10;

interface Entry {
  fingerprint: bigint;
  expiresAt: number;
  response: ReadingResponse;
}

/**
 * Remembers each device's recent readings in memory. Swap for Redis or a
 * database before running more than one server instance.
 */
export class ReadingStore {
  private byDevice = new Map<string, Entry[]>();

  constructor(private now: () => number = Date.now) {}

  findRepeat(deviceId: string, fp: bigint): ReadingResponse | null {
    const entries = this.live(deviceId);
    const match = entries.find((e) => hammingDistance(e.fingerprint, fp) <= REPEAT_DISTANCE);
    return match ? match.response : null;
  }

  save(deviceId: string, fp: bigint, response: ReadingResponse): void {
    const entries = this.live(deviceId);
    entries.push({ fingerprint: fp, expiresAt: this.now() + READING_TTL_MS, response });
    this.byDevice.set(deviceId, entries);
  }

  private live(deviceId: string): Entry[] {
    const now = this.now();
    const entries = (this.byDevice.get(deviceId) ?? []).filter((e) => e.expiresAt > now);
    if (entries.length === 0) this.byDevice.delete(deviceId);
    return entries;
  }
}
