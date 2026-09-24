/**
 * public/manifest.json 필드·아이콘 파일 단위 테스트 — FR-003 (PWA 설치)
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const APP_ROOT = path.resolve(__dirname, '../../..');
const manifestPath = path.join(APP_ROOT, 'public', 'manifest.json');

function readManifest(): Record<string, unknown> {
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  return JSON.parse(raw);
}

describe('manifest.json', () => {
  it('id·start_url이 /m/chat이고 scope가 /다', () => {
    const manifest = readManifest();
    expect(manifest.id).toBe('/m/chat');
    expect(manifest.start_url).toBe('/m/chat');
    expect(manifest.scope).toBe('/');
  });

  it('display가 standalone이다 (iOS 홈 화면 설치 필수 조건)', () => {
    const manifest = readManifest();
    expect(manifest.display).toBe('standalone');
  });

  it('name·short_name이 유지된다', () => {
    const manifest = readManifest();
    expect(manifest.name).toBe('ClaudeManager');
    expect(manifest.short_name).toBe('CM');
  });

  it('icons가 /icons/ 경로를 가리키고 192·512 사이즈를 포함한다', () => {
    const manifest = readManifest();
    const icons = manifest.icons as Array<{ src: string; sizes: string; type: string; purpose?: string }>;
    expect(Array.isArray(icons)).toBe(true);
    expect(icons.length).toBeGreaterThanOrEqual(2);
    for (const icon of icons) {
      expect(icon.src.startsWith('/icons/')).toBe(true);
      expect(icon.type).toBe('image/png');
    }
    const sizes = icons.map((icon) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('매니페스트가 참조하는 모든 아이콘 파일이 실제로 존재한다 (404 없음 — FR-003)', () => {
    const manifest = readManifest();
    const icons = manifest.icons as Array<{ src: string }>;
    for (const icon of icons) {
      const filePath = path.join(APP_ROOT, 'public', icon.src);
      expect(fs.existsSync(filePath), `${icon.src} 파일이 없다`).toBe(true);
    }
  });
});

describe('public/icons — 필요한 4개 파일이 모두 존재한다', () => {
  const iconsDir = path.join(APP_ROOT, 'public', 'icons');
  const required = ['icon-192.png', 'icon-512.png', 'apple-touch-icon-180.png', 'badge-72.png'];

  it.each(required)('%s 파일이 존재하고 PNG 시그니처를 가진다', (fileName) => {
    const filePath = path.join(iconsDir, fileName);
    expect(fs.existsSync(filePath)).toBe(true);
    const buf = fs.readFileSync(filePath);
    // PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
    expect(buf.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  });
});
