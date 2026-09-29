import * as Crypto from "expo-crypto";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as SecureStore from "expo-secure-store";
import type { ReadingResponse } from "./types";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";
const DEVICE_ID_KEY = "device-id";
/** Matches the server's limit; anything bigger is just wasted upload time. */
const MAX_EDGE = 1568;

/** A random ID stored on the device, so the server can spot repeat photos. */
async function deviceId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = Crypto.randomUUID();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
  return id;
}

async function shrinkToBase64(uri: string, width: number, height: number): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  if (Math.max(width, height) > MAX_EDGE) {
    context.resize(width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await context.renderAsync();
  const result = await image.saveAsync({ base64: true, compress: 0.85, format: SaveFormat.JPEG });
  if (!result.base64) throw new Error("Couldn't encode the photo.");
  return result.base64;
}

export async function requestReading(photo: { uri: string; width: number; height: number }): Promise<ReadingResponse> {
  const image = await shrinkToBase64(photo.uri, photo.width, photo.height);
  const response = await fetch(`${API_URL}/api/readings`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-device-id": await deviceId() },
    body: JSON.stringify({ image }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(body?.error ?? "The oracle couldn't be reached. Try again.");
  }
  return body as ReadingResponse;
}
