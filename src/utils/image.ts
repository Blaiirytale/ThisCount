// Photo helpers: check the file, then shrink it before uploading (saves data + storage)

export const MAX_PHOTO_MB = 10;
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

export type PhotoProblem = 'type' | 'size' | null;

export function checkPhoto(file: File): PhotoProblem {
  if (!ALLOWED.includes(file.type)) return 'type';
  if (file.size > MAX_PHOTO_MB * 1024 * 1024) return 'size';
  return null;
}

// Longest side becomes at most 1280px, saved as JPEG
export async function resizeImage(file: File, maxSide = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process photo'))), 'image/jpeg', 0.82),
  );
}
