/**
 * public/sw.js 단위 테스트 — DES-007 §6 (notificationclick 이동 URL 기본값)
 *
 * sw.js는 브라우저 서비스워커 전역(`self`)에서 실행되는 스크립트라 평범한 import로는 테스트할 수
 * 없다. `vm` 모듈로 `self`·`module`을 흉내 낸 컨텍스트에서 파일을 실행하고, sw.js 하단의
 * `module.exports` 가드(브라우저에서는 `typeof module === 'undefined'`로 no-op)로 노출된
 * `resolveNotificationTargetUrl`만 꺼내 검증한다.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const swPath = path.resolve(__dirname, '../../../public/sw.js');

function loadSwExports(): { resolveNotificationTargetUrl: (data: { url?: string } | null | undefined) => string } {
  const code = fs.readFileSync(swPath, 'utf-8');
  const moduleObj: { exports: Record<string, unknown> } = { exports: {} };
  const sandbox = {
    module: moduleObj,
    self: {
      addEventListener: () => {},
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'sw.js' });
  return moduleObj.exports as { resolveNotificationTargetUrl: (data: { url?: string } | null | undefined) => string };
}

describe('resolveNotificationTargetUrl (sw.js)', () => {
  it('data.url이 있으면 그 값을 사용한다', () => {
    const { resolveNotificationTargetUrl } = loadSwExports();
    expect(resolveNotificationTargetUrl({ url: '/m/chat/agent-1' })).toBe('/m/chat/agent-1');
  });

  it('data.url이 없으면 /m/chat을 기본값으로 사용한다 (FR-013)', () => {
    const { resolveNotificationTargetUrl } = loadSwExports();
    expect(resolveNotificationTargetUrl({})).toBe('/m/chat');
    expect(resolveNotificationTargetUrl(undefined)).toBe('/m/chat');
    expect(resolveNotificationTargetUrl(null)).toBe('/m/chat');
  });
});
