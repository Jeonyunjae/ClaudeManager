/**
 * ws.ts의 buildWsUrl() 단위 테스트
 * 대상 기능: HTTPS + NEXT_PUBLIC_WSS_PORT일 때 wss 주소 선택 (INT-001, DF-003)
 * 수용 기준:
 *   - HTTPS + wssPort 있음 → wss://<host>:<wssPort>/ws?token=...
 *   - HTTP(그 외) → ws://<host>:3001/ws?token=... (기존 동일)
 *   - HTTPS + wssPort 없음 → 기존 동작 유지 (ws(s):3001)
 */
import { describe, it, expect } from 'vitest';
import { buildWsUrl } from '@/lib/ws';

describe('buildWsUrl', () => {
  it('HTTPS + NEXT_PUBLIC_WSS_PORT가 있으면 해당 포트의 wss 주소를 만든다', () => {
    const url = buildWsUrl({
      protocol: 'https:',
      hostname: 'spark-3f44.tailed65d5.ts.net',
      token: 'abc123',
      wssPort: '8450',
    });
    expect(url).toBe('wss://spark-3f44.tailed65d5.ts.net:8450/ws?token=abc123');
  });

  it('HTTP 페이지면 기존과 동일하게 3001 포트의 ws 주소를 만든다', () => {
    const url = buildWsUrl({
      protocol: 'http:',
      hostname: '192.168.30.24',
      token: 'abc123',
      wssPort: '8450',
    });
    expect(url).toBe('ws://192.168.30.24:3001/ws?token=abc123');
  });

  it('HTTPS인데 NEXT_PUBLIC_WSS_PORT가 없으면 기존 동작(3001, wss)을 유지한다', () => {
    const url = buildWsUrl({
      protocol: 'https:',
      hostname: 'spark-3f44.tailed65d5.ts.net',
      token: 'abc123',
      wssPort: undefined,
    });
    expect(url).toBe('wss://spark-3f44.tailed65d5.ts.net:3001/ws?token=abc123');
  });

  it('HTTP + wssPort 없음도 기존과 동일하다', () => {
    const url = buildWsUrl({
      protocol: 'http:',
      hostname: 'localhost',
      token: 'tok',
      wssPort: undefined,
    });
    expect(url).toBe('ws://localhost:3001/ws?token=tok');
  });
});
