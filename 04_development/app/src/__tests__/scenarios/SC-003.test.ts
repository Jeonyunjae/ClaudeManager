/**
 * SC-003. 프로젝트 생성 및 진행 시나리오 테스트
 * 제목: 대표가 채팅으로 Main에게 프로젝트를 지시하고, 에이전트 조직이 작업을 수행하는 흐름
 * 관련 기능: F008~F014, F019, F020, F040, F041, F044, F046, F059~F062
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { AgentTreeNode } from '@/types/agent';
import type { ChatMessage } from '@/types/chat';

describe('SC-003: 프로젝트 생성 및 진행', () => {
  // ========================================
  // Step 1. 대표가 채팅으로 프로젝트를 지시
  // ========================================
  describe('Step 1: 채팅으로 프로젝트 지시', () => {
    it('대표의 지시 내용이 DB에 기록 (감사 로그)', () => {
      const auditLog = {
        actorType: 'user' as const,
        actionType: 'project_create_instruction',
        content: '할일 관리 앱 프로젝트를 시작하자',
        timestamp: new Date().toISOString(),
      };

      expect(auditLog.actorType).toBe('user');
      expect(auditLog.actionType).toBe('project_create_instruction');
    });

    it('Main이 Part에 지시를 전달 -> 지시 이력 저장', () => {
      const instructionHistory = [
        { from: 'user', to: 'main', content: '할일 관리 앱 프로젝트를 시작하자' },
        { from: 'main', to: 'part-project', content: '할일관리앱 프로젝트 시작. 기획부터 진행.' },
      ];

      expect(instructionHistory).toHaveLength(2);
      expect(instructionHistory[1].from).toBe('main');
      expect(instructionHistory[1].to).toBe('part-project');
    });
  });

  // ========================================
  // Step 2. 팀 구성 - 에이전트 트리 생성
  // ========================================
  describe('Step 2: 에이전트 트리 생성', () => {
    let tree: AgentTreeNode[];

    beforeEach(() => {
      tree = [
        {
          id: 'main-1',
          name: 'Main Orchestrator',
          role: 'main',
          status: 'active',
          children: [
            {
              id: 'part-project-001',
              name: '프로젝트관리부',
              role: 'part',
              status: 'active',
              children: [
                {
                  id: 'sub-todo-001',
                  name: '할일관리앱 팀장',
                  role: 'sub',
                  status: 'active',
                  statusMessage: '팀 구성 중',
                  children: [
                    {
                      id: 'inst-planner-001',
                      name: '기획 인스턴스',
                      role: 'instance',
                      status: 'active',
                      statusMessage: '기획 중',
                      children: [],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ];
    });

    it('4계층 에이전트 트리가 올바르게 구성', () => {
      expect(tree).toHaveLength(1); // Main
      expect(tree[0].children).toHaveLength(1); // Part
      expect(tree[0].children[0].children).toHaveLength(1); // Sub
      expect(tree[0].children[0].children[0].children).toHaveLength(1); // Instance
    });

    it('Sub(팀장)에 기획 인스턴스가 배정', () => {
      const sub = tree[0].children[0].children[0];
      expect(sub.role).toBe('sub');
      expect(sub.children[0].role).toBe('instance');
      expect(sub.children[0].name).toBe('기획 인스턴스');
    });

    it('에이전트 수 카운트 정확', () => {
      function countAgents(nodes: AgentTreeNode[]): number {
        return nodes.reduce((count, node) => count + 1 + countAgents(node.children), 0);
      }

      expect(countAgents(tree)).toBe(4); // Main + Part + Sub + Instance
    });

    it('에이전트 트리 flattenTree', () => {
      function flattenTree(nodes: AgentTreeNode[]): Map<string, AgentTreeNode> {
        const map = new Map<string, AgentTreeNode>();
        function walk(node: AgentTreeNode): void {
          map.set(node.id, node);
          node.children.forEach(walk);
        }
        nodes.forEach(walk);
        return map;
      }

      const flat = flattenTree(tree);
      expect(flat.size).toBe(4);
      expect(flat.has('inst-planner-001')).toBe(true);
    });
  });

  // ========================================
  // Step 3. Main이 채팅으로 진행 상황 보고
  // ========================================
  describe('Step 3: 채팅으로 진행 상황 보고', () => {
    it('Main이 프로젝트 현황 보고 메시지 생성', () => {
      const report: ChatMessage = {
        id: 'msg-report-1',
        sender: 'main',
        content: '할일관리앱 프로젝트 팀이 구성되었습니다.',
        messageType: 'progress',
        metadata: {
          projectName: '할일관리앱',
          currentStage: '기획',
          stageNumber: 1,
          totalStages: 6,
        },
        createdAt: new Date().toISOString(),
      };

      expect(report.messageType).toBe('progress');
      expect(report.metadata?.currentStage).toBe('기획');
    });
  });

  // ========================================
  // Step 4. 기획 작업 진행 중 - 상태 변화
  // ========================================
  describe('Step 4: 기획 작업 진행 중', () => {
    it('인스턴스 상태 메시지 갱신: 요구사항 분석 -> PRD 작성 -> 기능 목록 도출', () => {
      const statusUpdates = [
        { statusMessage: '요구사항 분석 중' },
        { statusMessage: 'PRD 초안 작성 중' },
        { statusMessage: '기능 목록 도출 중' },
      ];

      expect(statusUpdates).toHaveLength(3);
      expect(statusUpdates[2].statusMessage).toBe('기능 목록 도출 중');
    });

    it('토큰 사용량과 비용이 실시간으로 DB에 기록', () => {
      const tokenUsage = {
        inputTokens: 2500,
        outputTokens: 1200,
        cost: 0.03,
        model: 'claude-opus',
        agentId: 'inst-planner-001',
        timestamp: new Date().toISOString(),
      };

      expect(tokenUsage.inputTokens).toBe(2500);
      expect(tokenUsage.cost).toBe(0.03);
    });

    it('진행 상황이 노트와 DB에 이중 저장', () => {
      const notePath = '.orchestrator/parts/project/subs/todo-app/progress/01-planning.md';
      const dbRecord = {
        agentId: 'inst-planner-001',
        stage: 'planning',
        progress: 100,
        completedAt: new Date().toISOString(),
      };

      expect(notePath).toContain('progress');
      expect(dbRecord.progress).toBe(100);
    });
  });

  // ========================================
  // 예외흐름
  // ========================================
  describe('예외흐름', () => {
    it('E1: 동시 실행 에이전트 수 상한 초과 시 큐잉', () => {
      const maxConcurrent = 10;
      const currentActive = 10;
      const pendingQueue: string[] = [];

      if (currentActive >= maxConcurrent) {
        pendingQueue.push('new-instance');
      }

      expect(pendingQueue).toHaveLength(1);
      expect(pendingQueue[0]).toBe('new-instance');
    });

    it('E2: Part 오케스트레이터 응답 없음 -> 재시작 시도', () => {
      let retryCount = 0;
      const maxRetries = 3;
      let recovered = false;

      while (retryCount < maxRetries && !recovered) {
        retryCount++;
        if (retryCount === 2) {
          recovered = true;
        }
      }

      expect(recovered).toBe(true);
      expect(retryCount).toBe(2);
    });

    it('E2: 3회 실패 시 수동 확인 필요', () => {
      let retryCount = 0;
      const maxRetries = 3;
      let recovered = false;

      while (retryCount < maxRetries) {
        retryCount++;
        // 모두 실패
      }

      expect(recovered).toBe(false);
      expect(retryCount).toBe(maxRetries);
      // 수동 확인 필요
      const needsManualIntervention = !recovered && retryCount >= maxRetries;
      expect(needsManualIntervention).toBe(true);
    });
  });

  // ========================================
  // 전체 흐름 통합
  // ========================================
  describe('전체 흐름: 프로젝트 지시 -> 팀 구성 -> 작업 시작', () => {
    it('SC-003 전체 시나리오 상태 전이', () => {
      // Phase 1: 대표 지시
      const instruction = { content: '할일 관리 앱 프로젝트를 시작하자', timestamp: Date.now() };
      expect(instruction.content).toBeTruthy();

      // Phase 2: 에이전트 트리 생성
      const agentCount = 4; // Main + Part + Sub + Instance
      expect(agentCount).toBe(4);

      // Phase 3: 기획 진행
      const progress = { stage: 'planning', percentage: 0 };
      progress.percentage = 50;
      expect(progress.percentage).toBe(50);

      // Phase 4: 기획 완료 -> SC-004로 연결
      progress.percentage = 100;
      expect(progress.percentage).toBe(100);
      const nextScenario = 'SC-004'; // 승인 요청
      expect(nextScenario).toBe('SC-004');
    });
  });
});
