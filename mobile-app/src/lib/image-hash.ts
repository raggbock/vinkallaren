/**
 * Perceptual image hashing (dHash) for wine label matching.
 * dHash captures gradients (pixel-to-right-neighbor comparisons) which are
 * more robust than aHash across different lighting and backgrounds.
 * Runs entirely in the browser via Canvas API — no external dependencies.
 */

const DHASH_WIDTH = 9;  // 9 wide so we get 8 horizontal comparisons per row
const DHASH_HEIGHT = 8; // 8 rows × 8 comparisons = 64-bit hash

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
    hash: computeDHash(img, crop),
  }));
}

/** Compute a single dHash for an image region */
function computeDHash(img: HTMLImageElement, crop: CropRegion): string {
  const canvas = document.createElement("canvas");
  canvas.width = DHASH_WIDTH;
  canvas.height = DHASH_HEIGHT;
  const ctx = canvas.getContext("2d")!;

  // Draw the cropped region scaled down to 9×8
  ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, DHASH_WIDTH, DHASH_HEIGHT);
  const data = ctx.getImageData(0, 0, DHASH_WIDTH, DHASH_HEIGHT).data;

  // Convert to grayscale
  const pixels: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    pixels.push(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  // Build hash: compare each pixel to its right neighbor
  // 8 rows × 8 comparisons = 64 bits → 16 hex chars
  let hash = "";
  let bits = 0;
  let bitCount = 0;
  for (let y = 0; y < DHASH_HEIGHT; y++) {
    for (let x = 0; x < DHASH_WIDTH - 1; x++) {
      const idx = y * DHASH_WIDTH + x;
      bits = (bits << 1) | (pixels[idx] > pixels[idx + 1] ? 1 : 0);
      bitCount++;
      if (bitCount === 4) {
        hash += bits.toString(16);
        bits = 0;
        bitCount = 0;
      }
    }
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
 * Node.js-compatible dHash computation (for enrichment scripts).
 * Takes grayscale pixels and source dimensions, downscales to 9×8,
 * then compares each pixel to its right neighbor.
 */
export function computeDHashFromPixels(
  grayPixels: number[], width: number, height: number,
): string {
  // Simple nearest-neighbor downscale to 9×8
  const scaled: number[] = [];
  for (let y = 0; y < DHASH_HEIGHT; y++) {
    for (let x = 0; x < DHASH_WIDTH; x++) {
      const srcX = Math.floor(x * width / DHASH_WIDTH);
      const srcY = Math.floor(y * height / DHASH_HEIGHT);
      scaled.push(grayPixels[srcY * width + srcX]);
    }
  }

  // Compare each pixel to its right neighbor
  let hash = "";
  let bits = 0;
  let bitCount = 0;
  for (let y = 0; y < DHASH_HEIGHT; y++) {
    for (let x = 0; x < DHASH_WIDTH - 1; x++) {
      const idx = y * DHASH_WIDTH + x;
      bits = (bits << 1) | (scaled[idx] > scaled[idx + 1] ? 1 : 0);
      bitCount++;
      if (bitCount === 4) {
        hash += bits.toString(16);
        bits = 0;
        bitCount = 0;
      }
    }
  }
  return hash;
}
