/**
 * Client-side photo compression using Canvas API.
 *
 * Resizes to a maximum dimension and re-encodes as JPEG to keep upload sizes
 * well within the Supabase Storage bucket limit (20 MB) and to speed up
 * uploads on mobile data connections.
 */

export interface CompressOptions {
  /** Longest edge in pixels. Default 2048. */
  maxDimension?: number;
  /** JPEG quality 0-1. Default 0.75. */
  quality?: number;
}

/**
 * Compress a photo File into a JPEG Blob via an off-screen canvas.
 * Returns the compressed blob and the effective MIME type ('image/jpeg').
 */
export async function compressPhoto(
  file: File,
  opts: CompressOptions = {},
): Promise<{ blob: Blob; mime: string }> {
  const { maxDimension = 2048, quality = 0.75 } = opts;

  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > maxDimension || height > maxDimension) {
    const ratio = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  return { blob, mime: 'image/jpeg' };
}
