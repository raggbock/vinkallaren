/**
 * Perceptual image hashing (aHash) for wine label matching.
 * Runs entirely in the browser via Canvas API — no external dependencies.
 */

const HASH_SIZE = 8; // 8×8 = 64-bit hash

type CropRegion = { label: string; x: number; y: number; w: number; h: number };

/**
 * Compute perceptual hashes for multiple crop regions of an image.
 * Returns the hash for each crop as a hex string.
 */
export async function computeImageHashes(imageUri: string): Promise<{ label: string; hash: string }[]> {
  const img = await loadImage(imageUri);
  const { width: iw, height: ih } = img;

  const crops: CropRegion[] = [
    { label: "full", x: 0, y: 0, w: iw, h: ih },
    { label: "center", x: iw * 0.2, y: ih * 0.2, w: iw * 0.6, h: ih * 0.6 },
    { label: "lower", x: 0, y: ih * 0.4, w: iw, h: ih * 0.6 },
  ];

  return crops.map((crop) => ({
    label: crop.label,
    hash: computeAHash(img, crop),
  }));
}

/** Compute a single aHash for an image region */
function computeAHash(img: HTMLImageElement, crop: CropRegion): string {
  const canvas = document.createElement("canvas");
  canvas.width = HASH_SIZE;
  canvas.height = HASH_SIZE;
  const ctx = canvas.getContext("2d")!;

  // Draw the cropped region scaled down to 8×8
  ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, HASH_SIZE, HASH_SIZE);
  const data = ctx.getImageData(0, 0, HASH_SIZE, HASH_SIZE).data;

  // Convert to grayscale and compute mean
  const pixels: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }
  const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;

  // Build hash: each pixel above mean = 1
  let hash = "";
  for (let i = 0; i < pixels.length; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4 && i + j < pixels.length; j++) {
      if (pixels[i + j] >= mean) nibble |= (1 << (3 - j));
    }
    hash += nibble.toString(16);
  }
  return hash;
}

/** Hamming distance between two hex hash strings (0 = identical, 64 = opposite) */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const xor = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    // Count bits in xor (4-bit popcount)
    dist += ((xor >> 3) & 1) + ((xor >> 2) & 1) + ((xor >> 1) & 1) + (xor & 1);
  }
  return dist;
}

/** Convert hamming distance to 0-1 similarity (1 = identical) */
export function hashSimilarity(a: string, b: string): number {
  return 1 - hammingDistance(a, b) / 64;
}

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = uri;
  });
}

/**
 * Node.js-compatible aHash computation (for enrichment scripts).
 * Takes a raw image buffer and uses a simple averaging approach.
 */
export function computeAHashFromPixels(
  grayPixels: number[], width: number, height: number,
): string {
  // Simple nearest-neighbor downscale to 8×8
  const scaled: number[] = [];
  for (let y = 0; y < HASH_SIZE; y++) {
    for (let x = 0; x < HASH_SIZE; x++) {
      const srcX = Math.floor(x * width / HASH_SIZE);
      const srcY = Math.floor(y * height / HASH_SIZE);
      scaled.push(grayPixels[srcY * width + srcX]);
    }
  }

  const mean = scaled.reduce((a, b) => a + b, 0) / scaled.length;
  let hash = "";
  for (let i = 0; i < scaled.length; i += 4) {
    let nibble = 0;
    for (let j = 0; j < 4 && i + j < scaled.length; j++) {
      if (scaled[i + j] >= mean) nibble |= (1 << (3 - j));
    }
    hash += nibble.toString(16);
  }
  return hash;
}
