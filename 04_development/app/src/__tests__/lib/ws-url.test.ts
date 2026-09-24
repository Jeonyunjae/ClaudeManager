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

  // BUG-001b: 테스트 인스턴스처럼 WS 서버가 3001이 아닌 포트로 뜬 경우, HTTP 접속에서도
  // NEXT_PUBLIC_WS_PORT로 접속해야 한다 (그동안 WS_PORT 상수 3001로 고정되어 있었다).
  it('HTTP + NEXT_PUBLIC_WS_PORT가 있으면 그 포트로 접속한다 (BUG-001b)', () => {
    const url = buildWsUrl({
      protocol: 'http:',
      hostname: '127.0.0.1',
      token: 'tok',
      wssPort: undefined,
      wsPort: '3111',
    });
    expect(url).toBe('ws://127.0.0.1:3111/ws?token=tok');
  });

  it('HTTP + NEXT_PUBLIC_WS_PORT 없으면 기존과 동일하게 3001을 쓴다', () => {
    const url = buildWsUrl({
      protocol: 'http:',
      hostname: '127.0.0.1',
      token: 'tok',
      wssPort: undefined,
      wsPort: undefined,
    });
    expect(url).toBe('ws://127.0.0.1:3001/ws?token=tok');
  });

  it('HTTPS 경로는 NEXT_PUBLIC_WS_PORT의 영향을 받지 않는다 (HTTPS+WSS_PORT 규칙이 우선)', () => {
    const url = buildWsUrl({
      protocol: 'https:',
      hostname: 'spark-3f44.tailed65d5.ts.net',
      token: 'tok',
      wssPort: undefined,
      wsPort: '3111',
    });
    expect(url).toBe('wss://spark-3f44.tailed65d5.ts.net:3001/ws?token=tok');
  });
});
