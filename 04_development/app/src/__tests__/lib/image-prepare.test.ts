/**
 * 사진 업로드 전처리 순수 함수 단위 테스트 — FEAT-001
 */
import { describe, it, expect } from 'vitest';
import { fitWithin, toJpegName, shouldKeepOriginal, IMAGE_MAX_EDGE } from '@/lib/image-prepare';

describe('fitWithin', () => {
  it('긴 변이 기준 이하면 그대로 둔다', () => {
    expect(fitWithin(1200, 800)).toEqual({ width: 1200, height: 800 });
    expect(fitWithin(IMAGE_MAX_EDGE, 100)).toEqual({ width: IMAGE_MAX_EDGE, height: 100 });
  });

  it('세로 사진(아이폰 4032×3024 회전)은 긴 변을 2048로 줄이고 비율을 유지한다', () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1536, height: 2048 });
  });

  it('가로 사진도 긴 변 기준으로 줄인다', () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2048, height: 1536 });
  });

  it('0 크기는 그대로 둔다', () => {
    expect(fitWithin(0, 0)).toEqual({ width: 0, height: 0 });
  });
});

describe('toJpegName', () => {
  it.each([
    ['IMG_0001.HEIC', 'IMG_0001.jpg'],
    ['photo.png', 'photo.jpg'],
    ['a.b.jpeg', 'a.b.jpg'],
    ['noext', 'noext.jpg'],
    ['.heic', 'image.jpg'],
  ])('%s → %s', (input, expected) => {
    expect(toJpegName(input)).toBe(expected);
  });
});

describe('shouldKeepOriginal', () => {
  it('gif·svg는 변환하지 않는다', () => {
    expect(shouldKeepOriginal('image/gif')).toBe(true);
    expect(shouldKeepOriginal('image/svg+xml')).toBe(true);
  });

  it('jpeg·png·heic는 변환한다', () => {
    expect(shouldKeepOriginal('image/jpeg')).toBe(false);
    expect(shouldKeepOriginal('image/png')).toBe(false);
    expect(shouldKeepOriginal('image/heic')).toBe(false);
  });
});
