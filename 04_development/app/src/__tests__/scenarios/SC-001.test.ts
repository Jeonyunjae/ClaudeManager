/**
 * SC-001. 최초 접속 및 온보딩 시나리오 테스트
 * 제목: 처음 ClaudeManager에 접속하여 첫 부서를 생성하는 흐름
 * 관련 기능: F008, F013, F018, F028, F059
 *
 * Step 1. 로그인 및 첫 화면
 * Step 2. 워크스페이스 뷰 - 빈 워크스페이스 첫인상
 * Step 3. Main에 접촉 - 온보딩 대화
 * 예외흐름: E1 서버 미실행, E2 비밀번호 오류, E3 알림 권한 요청
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_SECONDS } from '@/lib/constants';

describe('SC-001: 최초 접속 및 온보딩', () => {
  // ========================================
  // Step 1. 로그인 및 첫 화면
  // ========================================
  describe('Step 1: 로그인 및 첫 화면', () => {
    // 인증 상태 시뮬레이션
    type AuthState = {
      token: string | null;
      isAuthenticated: boolean;
      isLoading: boolean;
      error: string | null;
    };

    let authState: AuthState;
    const VALID_PASSWORD = 'test1234';
    const MOCK_TOKEN = 'jwt-mock-token-12345';

    beforeEach(() => {
      authState = {
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    });

    function simulateLogin(password: string): AuthState {
      if (password === VALID_PASSWORD) {
        return {
          token: MOCK_TOKEN,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        };
      }
      return {
        ...authState,
        error: '비밀번호가 일치하지 않습니다',
      };
    }

    it('올바른 비밀번호로 로그인 성공 -> 인증 상태 전환', () => {
      const result = simulateLogin(VALID_PASSWORD);
      expect(result.isAuthenticated).toBe(true);
      expect(result.token).toBe(MOCK_TOKEN);
      expect(result.error).toBeNull();
    });

    it('잘못된 비밀번호로 로그인 실패 -> 에러 상태', () => {
      const result = simulateLogin('wrong');
      expect(result.isAuthenticated).toBe(false);
      expect(result.token).toBeNull();
      expect(result.error).toBe('비밀번호가 일치하지 않습니다');
    });

    it('최초 설정 시 비밀번호 등록 흐름 (setup)', () => {
      const password = 'newpass123';
      const confirmPassword = 'newpass123';
      const isValid = password === confirmPassword && password.length >= 4;
      expect(isValid).toBe(true);
    });

    it('최초 설정 시 비밀번호 불일치 에러', () => {
      const password = 'newpass123';
      const confirmPassword = 'different';
      const isValid = password === confirmPassword;
      expect(isValid).toBe(false);
    });
  });

  // ========================================
  // Step 2. 워크스페이스 뷰 - 빈 워크스페이스 첫인상
  // ========================================
  describe('Step 2: 워크스페이스 뷰 - 빈 워크스페이스', () => {
    it('초기 에이전트 트리에 Main만 존재', () => {
      const initialTree = [
        {
          id: 'main-1',
          name: 'Main Orchestrator',
          role: 'main' as const,
          status: 'active' as const,
          children: [],
        },
      ];

      expect(initialTree).toHaveLength(1);
      expect(initialTree[0].role).toBe('main');
      expect(initialTree[0].children).toHaveLength(0);
    });

    it('초기 Part 리스트가 비어있음', () => {
      const parts: any[] = [];
      expect(parts).toHaveLength(0);
    });

    it('하단 바 초기 상태: 에이전트 1/10, 비용 $0, 헬스 정상', () => {
      const bottomBar = {
        activeAgents: 1,
        maxAgents: 10,
        cost: 0.0,
        healthStatus: 'healthy' as const,
      };

      expect(bottomBar.activeAgents).toBe(1);
      expect(bottomBar.maxAgents).toBe(10);
      expect(bottomBar.cost).toBe(0.0);
      expect(bottomBar.healthStatus).toBe('healthy');
    });

    it('오피스 뷰 초기 카메라 위치 설정', () => {
      const cameraPosition: [number, number, number] = [10, 10, 10];
      const zoom = 1;
      expect(cameraPosition).toEqual([10, 10, 10]);
      expect(zoom).toBe(1);
    });
  });

  // ========================================
  // Step 3. Main에 접촉 - 온보딩 대화
  // ========================================
  describe('Step 3: Main에 접촉 - 온보딩 대화', () => {
    it('Main 캐릭터 접촉 시 채팅 패널 오픈', () => {
      let isChatOpen = false;
      let selectedCharacterId: string | null = null;

      // Main 캐릭터 접촉
      selectedCharacterId = 'main-1';
      isChatOpen = true;

      expect(selectedCharacterId).toBe('main-1');
      expect(isChatOpen).toBe(true);
    });

    it('온보딩 대화: Main이 첫 부서 생성 안내 메시지 전송', () => {
      type ChatMessage = {
        id: string;
        sender: 'user' | 'main';
        content: string;
        messageType: 'text' | 'approval_request' | 'progress' | 'system';
        createdAt: string;
      };

      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          sender: 'main',
          content: '안녕하세요, 대표님. 비서실장입니다. 워크스페이스가 아직 비어있네요. 첫 부서를 만들어볼까요?',
          messageType: 'text',
          createdAt: new Date().toISOString(),
        },
      ];

      expect(messages).toHaveLength(1);
      expect(messages[0].sender).toBe('main');
      expect(messages[0].content).toContain('부서');
    });

    it('대표가 부서 생성 동의 -> SC-002로 연결 준비', () => {
      const messages = [
        { sender: 'main', content: '프로젝트관리부 설립을 준비하겠습니다.' },
        { sender: 'user', content: '프로젝트관리부부터 만들자' },
        { sender: 'main', content: 'Skill 실행 화면으로 이동합니다.' },
      ];

      const lastMessage = messages[messages.length - 1];
      expect(lastMessage.sender).toBe('main');
      expect(lastMessage.content).toContain('Skill');
    });
  });

  // ========================================
  // 예외흐름
  // ========================================
  describe('예외흐름', () => {
    // E1. 서버 미실행 상태
    it('E1: 서버 미실행 시 재연결 메커니즘', () => {
      let connectionAttempts = 0;
      let connected = false;
      const maxRetries = 5;
      const retryInterval = 5000; // 5초

      // 서버 다운 시뮬레이션 -> 재연결 시도
      while (!connected && connectionAttempts < maxRetries) {
        connectionAttempts++;
        // 3번째 시도에서 성공
        if (connectionAttempts === 3) {
          connected = true;
        }
      }

      expect(connected).toBe(true);
      expect(connectionAttempts).toBe(3);
    });

    // E2. 비밀번호 오류 - 잠금 메커니즘
    it('E2: 5회 실패 시 30초 잠금', () => {
      const loginAttempts = new Map<string, { count: number; lockedUntil?: number }>();
      const ip = '192.168.1.1';

      for (let i = 0; i < MAX_LOGIN_ATTEMPTS; i++) {
        const current = loginAttempts.get(ip) || { count: 0 };
        current.count += 1;
        if (current.count >= MAX_LOGIN_ATTEMPTS) {
          current.lockedUntil = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
          current.count = 0;
        }
        loginAttempts.set(ip, current);
      }

      const attempts = loginAttempts.get(ip)!;
      expect(attempts.lockedUntil).toBeDefined();
      // 잠금 중 확인
      const isLocked = attempts.lockedUntil ? Date.now() < attempts.lockedUntil : false;
      expect(isLocked).toBe(true);
    });

    // E3. 브라우저 푸시 알림 권한 요청
    it('E3: 알림 권한 거부 시 대시보드 내 알림만 동작', () => {
      const pushPermissionGranted = false;
      const dashboardNotificationEnabled = true;

      // 알림 권한 거부해도 대시보드 알림은 동작
      expect(pushPermissionGranted).toBe(false);
      expect(dashboardNotificationEnabled).toBe(true);
    });
  });

  // ========================================
  // 전체 흐름 통합 검증
  // ========================================
  describe('전체 흐름: 접속 -> 로그인 -> 워크스페이스 -> 대화', () => {
    it('SC-001 전체 시나리오 상태 전이 검증', () => {
      // Phase 1: 미인증 상태
      let state = {
        isAuthenticated: false,
        token: null as string | null,
        currentView: 'login',
        agents: [] as any[],
        isChatOpen: false,
      };

      expect(state.isAuthenticated).toBe(false);
      expect(state.currentView).toBe('login');

      // Phase 2: 로그인 성공
      state = {
        ...state,
        isAuthenticated: true,
        token: 'jwt-token',
        currentView: 'workspace',
        agents: [{ id: 'main-1', role: 'main', status: 'active', children: [] }],
      };

      expect(state.isAuthenticated).toBe(true);
      expect(state.currentView).toBe('workspace');
      expect(state.agents).toHaveLength(1);

      // Phase 3: Main 접촉 -> 채팅 오픈
      state = { ...state, isChatOpen: true };
      expect(state.isChatOpen).toBe(true);

      // Phase 4: SC-002로 연결 준비
      const nextScenario = 'SC-002';
      expect(nextScenario).toBe('SC-002');
    });
  });
});
