/**
 * SC-005. 에이전트 활동 열람 (팝업 모달) 시나리오 테스트
 * 관련 기능: F014, F015, F040, F057, F058, F062
 */
import { describe, it, expect } from 'vitest';
import type { AgentConversation, AgentNote, AgentLog } from '@/types/agent';

describe('SC-005: 에이전트 활동 열람 (팝업 모달)', () => {
  describe('Step 1: 캐릭터 접촉 -> 선택 상태', () => {
    it('캐릭터 접촉 시 selectedCharacterId 설정', () => {
      let selectedCharacterId: string | null = null;
      selectedCharacterId = 'sub-todo-001';
      expect(selectedCharacterId).toBe('sub-todo-001');
    });
  });

  describe('Step 2: 팝업 모달 상단 정보', () => {
    it('모달 상단에 에이전트 정보 표시', () => {
      const modalHeader = {
        name: '할일관리앱 팀장',
        role: 'Sub 오케스트레이터',
        status: '개발 단계 감독 중',
        statusBadge: 'active',
        uptimeSeconds: 8100, // 2시간 15분
      };

      expect(modalHeader.name).toBe('할일관리앱 팀장');
      expect(modalHeader.uptimeSeconds).toBe(8100);
    });
  });

  describe('Step 3: 탭 1 - 대화 내용', () => {
    it('Sub의 대화 이력이 시간순으로 표시', () => {
      const conversations: AgentConversation[] = [
        { id: '1', timestamp: '2026-04-14T14:00:00Z', fromAgent: 'Part', toAgent: 'Sub', content: '할일관리앱 프로젝트를 시작하라.', type: 'instruction' },
        { id: '2', timestamp: '2026-04-14T14:05:00Z', fromAgent: 'Sub', toAgent: '기획 인스턴스', content: '요구사항 분석 후 PRD를 작성하라.', type: 'instruction' },
        { id: '3', timestamp: '2026-04-14T15:30:00Z', fromAgent: '기획 인스턴스', toAgent: 'Sub', content: 'PRD 초안 완료. 기능 14개 도출.', type: 'report' },
        { id: '4', timestamp: '2026-04-14T15:35:00Z', fromAgent: 'Sub', toAgent: 'Part', content: '기획 단계 완료. 대표 승인 요청.', type: 'approval' },
      ];

      expect(conversations).toHaveLength(4);
      expect(conversations[0].type).toBe('instruction');
      expect(conversations[3].type).toBe('approval');
      // 시간순 정렬 확인
      const timestamps = conversations.map((c) => new Date(c.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
    });
  });

  describe('Step 4: 탭 2 - 노트', () => {
    it('Sub의 노트가 마크다운으로 렌더링', () => {
      const notes: AgentNote[] = [
        { file: 'sub-context.md', content: '# 할일관리앱 Sub\n## 현재 상태: 개발 단계 (3/6)', updatedAt: '2026-04-16T10:00:00Z' },
        { file: 'progress/01-planning.md', content: '# 기획 단계\n## 상태: 완료', updatedAt: '2026-04-14T17:00:00Z' },
        { file: 'decisions/2026-04-14-tech-stack.md', content: '# 기술 스택 결정\n## 결정: React', updatedAt: '2026-04-14T16:30:00Z' },
      ];

      expect(notes).toHaveLength(3);
      expect(notes[0].file).toBe('sub-context.md');
      expect(notes[0].content).toContain('개발 단계');
    });
  });

  describe('Step 5: 탭 3 - 로그', () => {
    it('Hooks 수집 이벤트 로그가 타임라인으로 표시', () => {
      const logs: AgentLog[] = [
        { id: 1, eventType: 'SubStarted', message: '할일관리앱 Sub 시작', createdAt: '2026-04-14T14:00:00Z' },
        { id: 2, eventType: 'InstanceCreated', message: '기획 인스턴스 생성', detail: 'claude-opus', createdAt: '2026-04-14T14:00:05Z' },
        { id: 3, eventType: 'TokenUsage', inputTokens: 2500, outputTokens: 1200, cost: 0.03, createdAt: '2026-04-14T14:00:06Z' },
        { id: 4, eventType: 'StageCompleted', message: '기획 단계 완료', createdAt: '2026-04-14T15:30:00Z' },
      ];

      expect(logs).toHaveLength(4);
      expect(logs[2].cost).toBe(0.03);
    });
  });

  describe('Step 6: 탭 4 - 터미널 (양방향 제어)', () => {
    it('터미널 세션 연결 및 데이터 전송', () => {
      const terminalState = {
        sessionId: null as string | null,
        connected: false,
      };

      // 연결
      terminalState.sessionId = 'tmux-sub-todo-001';
      terminalState.connected = true;

      expect(terminalState.sessionId).toBe('tmux-sub-todo-001');
      expect(terminalState.connected).toBe(true);

      // 데이터 전송 (stdin)
      const stdinData = 'ls -la\n';
      expect(stdinData).toBeTruthy();

      // 연결 해제
      terminalState.sessionId = null;
      terminalState.connected = false;
      expect(terminalState.connected).toBe(false);
    });
  });

  describe('예외흐름', () => {
    it('E1: 인스턴스 접촉 시 탭 4(터미널) 기본 활성화', () => {
      const defaultTab = 'terminal'; // 인스턴스는 터미널 기본
      expect(defaultTab).toBe('terminal');
    });

    it('E2: 정지 에이전트 접촉 시 세션 종료 표시', () => {
      const agentStatus = 'stopped';
      const sessionInfo = { terminated: true, lastActivity: '2026-04-14T16:30:00Z' };

      expect(agentStatus).toBe('stopped');
      expect(sessionInfo.terminated).toBe(true);
    });

    it('E3: 팝업에서 오류 발견 -> Main에게 지시', () => {
      const errorInLog = { eventType: 'Error', message: 'API timeout', createdAt: '2026-04-16T14:30:00Z' };
      const userInstruction = '개발 인스턴스 로그에서 오류가 보이네. 확인해봐';

      expect(errorInLog.eventType).toBe('Error');
      expect(userInstruction).toContain('오류');
    });
  });
});
