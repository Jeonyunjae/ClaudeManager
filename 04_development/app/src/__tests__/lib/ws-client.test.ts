/**
 * @vitest-environment jsdom
 *
 * lib/ws.ts의 WebSocketClient(싱글턴 wsClient) 단위 테스트 — INT-001, DF-003.
 * buildWsUrl()의 순수 함수 부분은 ws-url.test.ts(node 환경)에서 이미 검증했다.
 * 이 파일은 connect/onopen/onmessage/onclose/onerror/재연결/on·off/send/disconnect를 검증한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];
  closed = false;

  constructor(public url: string) {
    instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.readyState = MockWebSocket.CLOSED;
  }

  open(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  /** 실제 브라우저는 close 이벤트 전에 readyState를 CLOSED로 바꾼다. */
  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.();
  }
}

let instances: MockWebSocket[] = [];
let shouldThrowOnConstruct = false;

class ThrowingWebSocket {
  constructor() {
    throw new Error('construct failed');
  }
}

beforeEach(() => {
  instances = [];
  shouldThrowOnConstruct = false;
  vi.useFakeTimers();
  vi.stubGlobal(
    'WebSocket',
    new Proxy(MockWebSocket, {
      construct(target, args) {
        if (shouldThrowOnConstruct) throw new Error('construct failed');
        return new target(...(args as [string]));
      },
    })
  );
  vi.stubGlobal('window', {
    location: { protocol: 'http:', hostname: 'localhost' },
  });
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function loadClient() {
  const mod = await import('@/lib/ws');
  return mod.default;
}

describe('WebSocketClient.connect / doConnect', () => {
  it('connect()하면 WebSocket을 생성하고 open 이벤트에서 connection:open을 emit한다', async () => {
    const client = await loadClient();
    const handler = vi.fn();
    client.on('connection:open', handler);

    client.connect('tok');
    expect(instances).toHaveLength(1);
    expect(instances[0].url).toContain('ws://localhost:3001/ws?token=tok');

    instances[0].open();
    expect(handler).toHaveBeenCalledWith({});
    expect(client.isConnected).toBe(true);
  });

  it('연결 중(isConnecting)에 다시 connect()해도 두 번째 WebSocket을 만들지 않는다', async () => {
    const client = await loadClient();
    client.connect('tok');
    client.connect('tok');
    expect(instances).toHaveLength(1);
  });

  it('이미 OPEN 상태면 doConnect가 다시 만들지 않는다', async () => {
    const client = await loadClient();
    client.connect('tok');
    instances[0].open();
    client.connect('tok2');
    expect(instances).toHaveLength(1);
  });

  it('WebSocket 생성 자체가 실패하면 재연결을 예약한다', async () => {
    const client = await loadClient();
    shouldThrowOnConstruct = true;
    client.connect('tok');
    expect(instances).toHaveLength(0);

    shouldThrowOnConstruct = false;
    vi.advanceTimersByTime(1000);
    expect(instances).toHaveLength(1);
  });
});

describe('WebSocketClient - message dispatch', () => {
  it('onmessage로 받은 메시지를 type별 핸들러에 전달한다', async () => {
    const client = await loadClient();
    const handler = vi.fn();
    client.on('chat:message', handler);

    client.connect('tok');
    instances[0].onmessage?.({
      data: JSON.stringify({ type: 'chat:message', payload: { id: 1 } }),
    });

    expect(handler).toHaveBeenCalledWith({ id: 1 });
  });

  it('JSON 파싱에 실패해도 던지지 않는다', async () => {
    const client = await loadClient();
    client.connect('tok');
    expect(() => instances[0].onmessage?.({ data: 'not-json' })).not.toThrow();
  });

  it('핸들러 내부에서 예외가 나도 다른 핸들러 실행에 영향을 주지 않는다', async () => {
    const client = await loadClient();
    const bad = vi.fn(() => {
      throw new Error('boom');
    });
    const good = vi.fn();
    client.on('chat:message', bad);
    client.on('chat:message', good);

    client.connect('tok');
    expect(() =>
      instances[0].onmessage?.({
        data: JSON.stringify({ type: 'chat:message', payload: {} }),
      })
    ).not.toThrow();
    expect(good).toHaveBeenCalled();
  });
});

describe('WebSocketClient - close/error/reconnect', () => {
  it('onclose에서 connection:close를 emit하고 재연결을 예약한다(지수 백오프)', async () => {
    const client = await loadClient();
    const closeHandler = vi.fn();
    client.on('connection:close', closeHandler);

    client.connect('tok');
    instances[0].open();
    instances[0].simulateClose();
    expect(closeHandler).toHaveBeenCalledWith({});
    expect(client.isConnected).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(instances).toHaveLength(2);

    // 두 번째 재연결부터는 지연이 두 배(2000ms)로 늘어난다
    instances[1].simulateClose();
    vi.advanceTimersByTime(1000);
    expect(instances).toHaveLength(2);
    vi.advanceTimersByTime(1000);
    expect(instances).toHaveLength(3);
  });

  it('onerror에서 connection:error를 emit한다', async () => {
    const client = await loadClient();
    const errHandler = vi.fn();
    client.on('connection:error', errHandler);

    client.connect('tok');
    instances[0].onerror?.();
    expect(errHandler).toHaveBeenCalledWith({});
  });
});

describe('WebSocketClient - send/on/off/disconnect', () => {
  it('OPEN 상태에서만 send가 실제로 전송한다', async () => {
    const client = await loadClient();
    client.connect('tok');

    client.send('ping', { a: 1 });
    expect(instances[0].sent).toHaveLength(0);

    instances[0].open();
    client.send('ping', { a: 1 });
    expect(instances[0].sent).toHaveLength(1);
    const sentMsg = JSON.parse(instances[0].sent[0]);
    expect(sentMsg.type).toBe('ping');
    expect(sentMsg.payload).toEqual({ a: 1 });
  });

  it('off()로 구독을 해제하면 더 이상 호출되지 않는다', async () => {
    const client = await loadClient();
    const handler = vi.fn();
    client.on('chat:message', handler);
    client.off('chat:message', handler);

    client.connect('tok');
    instances[0].onmessage?.({
      data: JSON.stringify({ type: 'chat:message', payload: {} }),
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('on()이 돌려주는 unsubscribe 함수로도 해제할 수 있다', async () => {
    const client = await loadClient();
    const handler = vi.fn();
    const unsubscribe = client.on('chat:message', handler);
    unsubscribe();

    client.connect('tok');
    instances[0].onmessage?.({
      data: JSON.stringify({ type: 'chat:message', payload: {} }),
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('disconnect()는 소켓을 닫고 재연결 타이머를 취소하며 isConnected를 false로 만든다', async () => {
    const client = await loadClient();
    client.connect('tok');
    instances[0].open();

    client.disconnect();
    expect(instances[0].closed).toBe(true);
    expect(client.isConnected).toBe(false);

    // disconnect 이후 예약돼 있던 재연결이 없어야 한다
    vi.advanceTimersByTime(10000);
    expect(instances).toHaveLength(1);
  });
});
