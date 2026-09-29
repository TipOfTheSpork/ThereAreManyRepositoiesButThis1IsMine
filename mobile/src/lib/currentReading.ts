import type { ReadingResponse } from "./types";

// Hands the latest reading from the camera screen to the reading screen.
// Too big for route params, and not worth a state library yet.
let current: { reading: ReadingResponse; photoUri: string } | null = null;

export function setCurrentReading(value: typeof current) {
  current = value;
}

export function getCurrentReading() {
  return current;
}
