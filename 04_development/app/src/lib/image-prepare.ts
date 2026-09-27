'use client';

/** 업로드 전 사진의 긴 변 최대 길이(px). 에이전트가 읽기에 충분하고 전송은 빠르다 */
export const IMAGE_MAX_EDGE = 2048;
export const IMAGE_JPEG_QUALITY = 0.85;

/** 비율을 유지한 채 긴 변을 `max` 이하로 맞춘 크기 (이미 작으면 그대로) */
export function fitWithin(width: number, height: number, max: number = IMAGE_MAX_EDGE): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= max || longest === 0) return { width, height };
  const scale = max / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** 확장자를 `.jpg`로 바꾼 파일명 (`IMG_0001.HEIC` → `IMG_0001.jpg`) */
export function toJpegName(name: string): string {
  const base = name.replace(/\.[^./\\]+$/, '') || 'image';
  return `${base}.jpg`;
}

/** 다시 인코딩하지 않고 그대로 올리는 형식 — 애니메이션·벡터는 변환하면 망가진다 */
export function shouldKeepOriginal(type: string): boolean {
  return type === 'image/gif' || type === 'image/svg+xml';
}

/**
 * 아이폰 사진(HEIC·대용량 JPEG 등)을 긴 변 2048px JPEG로 줄인다 (FEAT-001).
 * 브라우저가 디코드하지 못하면 원본을 그대로 돌려준다 — 서버가 형식·크기를 다시 검사한다.
 */
export async function prepareImage(file: File): Promise<File> {
  if (shouldKeepOriginal(file.type) || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', IMAGE_JPEG_QUALITY));
    if (!blob) return file;
    return new File([blob], toJpegName(file.name), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
