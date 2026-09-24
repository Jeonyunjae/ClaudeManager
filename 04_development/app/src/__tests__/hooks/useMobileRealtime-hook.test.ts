/**
 * @vitest-environment jsdom
 *
 * hooks/useMobileRealtime.ts의 훅 자체(useMobileRealtime·useWsConnectionStatus) 단위 테스트
 * — FR-005, DES-006 EVT-SH-1·EVT-SH-2, DES-007 §4.
 * 순수 함수(isReconnectTransition·shouldReconnectOnVisible)는
 * useMobileRealtime.test.ts(node 환경)에서 이미 검증했다. 이 파일은 wsClient 이벤트 구독·해제,
 * store 반영, WS 연결 상태 훅의 재조회 트리거·visibilitychange 재연결을 검증한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

type Handler = (payload: unknown) => void;

const handlers = new Map<string, Set<Handler>>();
const mockOn = vi.fn((type: string, handler: Handler) => {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(handler);
  return () => handlers.get(type)?.delete(handler);
});
const mockConnect = vi.fn();
let mockIsConnected = false;

function emit(type: string, payload: unknown): void {
  handlers.get(type)?.forEach((h) => h(payload));
}

vi.mock('@/lib/ws', () => ({
  default: {
    on: mockOn,
    connect: mockConnect,
    get isConnected() {
      return mockIsConnected;
    },
  },
}));

const mockApplyStream = vi.fn();
const mockApplyTool = vi.fn();
const mockApplyTyping = vi.fn();
const mockApplyQueue = vi.fn();
const mockApplyMessage = vi.fn();

vi.mock('@/stores/mobileChatStore', () => ({
  useMobileChatStore: {
    getState: () => ({
      applyStream: mockApplyStream,
      applyTool: mockApplyTool,
      applyTyping: mockApplyTyping,
      applyQueue: mockApplyQueue,
      applyMessage: mockApplyMessage,
    }),
  },
}));

const mockFetchInbox = vi.fn();
vi.mock('@/stores/inboxStore', () => ({
  useInboxStore: {
    getState: () => ({ fetchInbox: mockFetchInbox }),
  },
}));

const mockUpdateAgentStatus = vi.fn();
vi.mock('@/stores/agentStore', () => ({
  useAgentStore: {
    getState: () => ({ updateAgentStatus: mockUpdateAgentStatus }),
  },
}));

describe('useMobileRealtime', () => {
  beforeEach(() => {
    handlers.clear();
    mockOn.mockClear();
    mockConnect.mockClear();
    mockIsConnected = false;
    mockApplyStream.mockReset();
    mockApplyTool.mockReset();
    mockApplyTyping.mockReset();
    mockApplyQueue.mockReset();
    mockApplyMessage.mockReset();
    mockFetchInbox.mockReset();
    mockUpdateAgentStatus.mockReset();
  });

  it('마운트 시 chat:*, agent:status 이벤트를 구독한다', async () => {
    const { useMobileRealtime } = await import('@/hooks/useMobileRealtime');
    renderHook(() => useMobileRealtime());

    for (const type of ['chat:stream', 'chat:tool', 'chat:typing', 'chat:queue', 'chat:message', 'agent:status']) {
      expect(handlers.has(type)).toBe(true);
    }
  });

  it('chat:stream 이벤트를 store.applyStream으로 전달한다', async () => {
    const { useMobileRealtime } = await import('@/hooks/useMobileRealtime');
    renderHook(() => useMobileRealtime());

    const payload = { agentId: 'a1', responseMsgId: 'm1', content: 'hi' };
    emit('chat:stream', payload);

    expect(mockApplyStream).toHaveBeenCalledWith(payload);
  });

  it('chat:message가 sender!=user면 인박스를 재조회한다', async () => {
    const { useMobileRealtime } = await import('@/hooks/useMobileRealtime');
    renderHook(() => useMobileRealtime());

    emit('chat:message', {
      id: '1',
      sender: 'agent',
      content: 'hello',
      messageType: 'text',
      agentId: 'a1',
      createdAt: '2026-09-24T00:00:00.000Z',
    });

    expect(mockApplyMessage).toHaveBeenCalled();
    expect(mockFetchInbox).toHaveBeenCalledTimes(1);
  });

  it('chat:message가 sender=user면 인박스를 재조회하지 않는다', async () => {
    const { useMobileRealtime } = await import('@/hooks/useMobileRealtime');
    renderHook(() => useMobileRealtime());

    emit('chat:message', {
      id: '1',
      sender: 'user',
      content: 'hello',
      messageType: 'text',
      agentId: 'a1',
      createdAt: '2026-09-24T00:00:00.000Z',
    });

    expect(mockFetchInbox).not.toHaveBeenCalled();
  });

  it('agent:status 이벤트를 agentStore.updateAgentStatus로 전달한다', async () => {
    const { useMobileRealtime } = await import('@/hooks/useMobileRealtime');
    renderHook(() => useMobileRealtime());

    emit('agent:status', { agentId: 'a1', status: 'active', statusMessage: 'working' });

    expect(mockUpdateAgentStatus).toHaveBeenCalledWith('a1', 'active', 'working');
  });

  it('언마운트 시 모든 구독을 해제한다', async () => {
    const { useMobileRealtime } = await import('@/hooks/useMobileRealtime');
    const { unmount } = renderHook(() => useMobileRealtime());

    expect(handlers.get('chat:stream')?.size).toBe(1);
    unmount();
    expect(handlers.get('chat:stream')?.size).toBe(0);
  });
});

describe('useWsConnectionStatus', () => {
  beforeEach(() => {
    handlers.clear();
    mockOn.mockClear();
    mockConnect.mockClear();
    mockIsConnected = false;
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('초기값은 wsClient.isConnected를 따른다', async () => {
    mockIsConnected = true;
    const { useWsConnectionStatus } = await import('@/hooks/useMobileRealtime');
    const { result } = renderHook(() => useWsConnectionStatus());
    expect(result.current).toBe(true);
  });

  it('connection:open이 오면 true로, connection:close가 오면 false로 바뀐다', async () => {
    const { useWsConnectionStatus } = await import('@/hooks/useMobileRealtime');
    const { result } = renderHook(() => useWsConnectionStatus());
    expect(result.current).toBe(false);

    act(() => emit('connection:open', {}));
    expect(result.current).toBe(true);

    act(() => emit('connection:close', {}));
    expect(result.current).toBe(false);
  });

  it('끊김→연결 전이일 때만 onReconnect를 정확히 한 번 호출한다', async () => {
    const onReconnect = vi.fn();
    const { useWsConnectionStatus } = await import('@/hooks/useMobileRealtime');
    renderHook(() => useWsConnectionStatus(onReconnect));

    // 최초 상태(false)에서 open은 전이(false->true)이므로 호출된다
    act(() => emit('connection:open', {}));
    expect(onReconnect).toHaveBeenCalledTimes(1);

    // 이미 연결된 상태에서 다시 open이 와도(전이 아님) 호출되지 않는다
    act(() => emit('connection:open', {}));
    expect(onReconnect).toHaveBeenCalledTimes(1);

    act(() => emit('connection:close', {}));
    act(() => emit('connection:open', {}));
    expect(onReconnect).toHaveBeenCalledTimes(2);
  });

  it('탭이 백그라운드에서 돌아왔고 끊긴 채면 저장된 토큰으로 재연결을 시도한다', async () => {
    localStorage.setItem('auth_token', 'tok-xyz');
    const { useWsConnectionStatus } = await import('@/hooks/useMobileRealtime');
    renderHook(() => useWsConnectionStatus());

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(mockConnect).toHaveBeenCalledWith('tok-xyz');
  });

  it('이미 연결돼 있으면 visibilitychange에서 재연결하지 않는다', async () => {
    mockIsConnected = true;
    const { useWsConnectionStatus } = await import('@/hooks/useMobileRealtime');
    renderHook(() => useWsConnectionStatus());

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => document.dispatchEvent(new Event('visibilitychange')));

    expect(mockConnect).not.toHaveBeenCalled();
  });

  it('언마운트 시 visibilitychange 리스너를 제거한다', async () => {
    const { useWsConnectionStatus } = await import('@/hooks/useMobileRealtime');
    const { unmount } = renderHook(() => useWsConnectionStatus());
    unmount();

    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockConnect).not.toHaveBeenCalled();
  });
});
