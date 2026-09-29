import sharp from "sharp";

/** Longest edge sent to Claude; larger images are downscaled server-side anyway. */
const MAX_EDGE = 1568;

/**
 * Re-encodes the upload as a JPEG no larger than MAX_EDGE. Re-encoding also
 * strips EXIF metadata such as GPS location before the photo leaves our server.
 */
export async function normalizePhoto(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate() // apply EXIF orientation before the metadata is dropped
    .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
}

/**
 * 64-bit difference hash (dHash). Photos of the same glass taken moments apart
 * produce hashes a few bits apart; different glasses land much further away.
 */
export async function fingerprint(image: Buffer): Promise<bigint> {
  const pixels = await sharp(image)
    .greyscale()
    .resize(9, 8, { fit: "fill" })
    .raw()
    .toBuffer();

  let hash = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = pixels[row * 9 + col];
      const right = pixels[row * 9 + col + 1];
      hash = (hash << 1n) | (left > right ? 1n : 0n);
    }
  }
  return hash;
}

export function hammingDistance(a: bigint, b: bigint): number {
  let diff = a ^ b;
  let count = 0;
  while (diff) {
    count += Number(diff & 1n);
    diff >>= 1n;
  }
  return count;
}
