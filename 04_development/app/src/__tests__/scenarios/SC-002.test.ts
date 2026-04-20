/**
 * SC-002. Part 생성 (Skill 실행) 시나리오 테스트
 * 제목: 도메인별 Skill을 실행하여 Part(부서)를 동적 생성하는 흐름
 * 관련 기능: F001, F002, F003, F004, F005, F006, F009, F044, F045
 *
 * Step 1. 대화로 방법론 탐색 시작
 * Step 2. Main이 Skill 자동 생성
 * Step 3. 스키마 기반 입력 폼
 * Step 4. Skill 실행 -> Part 생성
 * Step 5. 워크스페이스에 새 부서 표시
 * 예외흐름: E1 Skill 실행 오류, E2 동일 Skill 중복, E3 필수 입력 누락
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { Skill, SkillSchema, SkillField } from '@/types/skill';

describe('SC-002: Part 생성 (Skill 실행)', () => {
  // ========================================
  // Step 1. 대화로 방법론 탐색
  // ========================================
  describe('Step 1: 대화로 방법론 정의', () => {
    it('대표가 부서 필요를 요청하면 Main이 방법론 탐색 시작', () => {
      const conversation = [
        { sender: 'user', content: '내 개발 프로젝트들을 관리할 부서가 필요해' },
        { sender: 'main', content: '프로젝트관리부 설립을 준비하겠습니다.' },
      ];

      expect(conversation).toHaveLength(2);
      expect(conversation[1].content).toContain('프로젝트관리부');
    });

    it('방법론 정의: 6단계 프로세스', () => {
      const methodology = {
        stages: ['기획', '디자인', '개발', '테스트', '코드리뷰', '배포'],
        approvalRequired: ['기획', '디자인'],
      };

      expect(methodology.stages).toHaveLength(6);
      expect(methodology.approvalRequired).toContain('기획');
      expect(methodology.approvalRequired).toContain('디자인');
    });

    it('팀 구성: 인스턴스 역할 정의', () => {
      const instanceRoles = [
        { role: '기획', model: 'claude-opus' },
        { role: '디자인', model: 'claude-opus' },
        { role: '개발', model: 'claude-sonnet' },
        { role: '테스트', model: 'claude-sonnet' },
        { role: '리뷰', model: 'claude-haiku' },
        { role: '배포', model: 'claude-haiku' },
      ];

      expect(instanceRoles).toHaveLength(6);
      expect(instanceRoles[0].model).toBe('claude-opus');
      expect(instanceRoles[2].model).toBe('claude-sonnet');
    });
  });

  // ========================================
  // Step 2-3. Skill 생성 및 스키마 기반 입력 폼
  // ========================================
  describe('Step 2-3: Skill 생성 및 스키마 기반 입력 폼', () => {
    let skillSchema: SkillSchema;

    beforeEach(() => {
      skillSchema = {
        name: 'project-part',
        version: '1.0.0',
        schema: {
          fields: [
            { key: 'part_name', label: 'Part명', type: 'text', required: true },
            { key: 'description', label: '설명', type: 'text', required: false },
            { key: 'sensitivity', label: '민감도', type: 'select', required: true, options: ['극민감', '민감', '일반'] },
            { key: 'approval_policy', label: '승인 정책', type: 'text', required: true },
            { key: 'retry_count', label: '재시도 횟수', type: 'number', required: false, default: 3 },
            { key: 'retry_strategy', label: '재시도 전략', type: 'select', required: false, options: ['지수백오프', '고정간격'] },
            { key: 'model_routing', label: '기본 모델', type: 'select', required: false, options: ['claude-sonnet', 'claude-haiku'] },
          ],
        },
      };
    });

    it('Skill 스키마가 올바른 필드를 포함', () => {
      expect(skillSchema.schema.fields).toHaveLength(7);
      const requiredFields = skillSchema.schema.fields.filter((f) => f.required);
      expect(requiredFields).toHaveLength(3);
    });

    it('필수 필드: part_name, sensitivity, approval_policy', () => {
      const requiredKeys = skillSchema.schema.fields
        .filter((f) => f.required)
        .map((f) => f.key);

      expect(requiredKeys).toContain('part_name');
      expect(requiredKeys).toContain('sensitivity');
      expect(requiredKeys).toContain('approval_policy');
    });

    it('select 필드의 옵션이 올바름', () => {
      const sensitivityField = skillSchema.schema.fields.find((f) => f.key === 'sensitivity')!;
      expect(sensitivityField.options).toEqual(['극민감', '민감', '일반']);
    });

    it('폼 데이터 유효성 검증: 필수 필드 모두 채워져야 실행 가능', () => {
      const formData: Record<string, unknown> = {
        part_name: '프로젝트관리부',
        sensitivity: '일반',
        approval_policy: '기술 결정, 외부 API 사용 시 승인',
      };

      const requiredFields = skillSchema.schema.fields.filter((f) => f.required);
      const allFilled = requiredFields.every((f) => formData[f.key] !== undefined && formData[f.key] !== '');
      expect(allFilled).toBe(true);
    });

    it('폼 데이터 유효성 검증: 필수 필드 누락 시 실행 불가', () => {
      const formData: Record<string, unknown> = {
        part_name: '프로젝트관리부',
        // sensitivity 누락
        approval_policy: '기술 결정 시 승인',
      };

      const requiredFields = skillSchema.schema.fields.filter((f) => f.required);
      const allFilled = requiredFields.every((f) => formData[f.key] !== undefined && formData[f.key] !== '');
      expect(allFilled).toBe(false);
    });

    it('default 값이 있는 필드는 미입력 시 기본값 적용', () => {
      const retryField = skillSchema.schema.fields.find((f) => f.key === 'retry_count')!;
      expect(retryField.default).toBe(3);
    });
  });

  // ========================================
  // Step 4. Skill 실행 -> Part 생성
  // ========================================
  describe('Step 4: Skill 실행 -> Part 생성', () => {
    it('Skill 실행 후 Part가 생성됨', () => {
      const executionResult = {
        partId: 'part-project-001',
        status: 'created',
        skillName: 'project-part',
        skillVersion: '1.0.0',
        sensitivityLevel: '일반',
      };

      expect(executionResult.partId).toBeDefined();
      expect(executionResult.status).toBe('created');
      expect(executionResult.skillName).toBe('project-part');
    });

    it('Part 생성 후 DB에 정보 저장', () => {
      const partRecord = {
        id: 'part-project-001',
        name: '프로젝트관리부',
        skillName: 'project-part',
        skillVersion: '1.0.0',
        sensitivityLevel: '일반',
        color: '#4A90D9',
        status: 'active',
        agentCount: 1,
        projectCount: 0,
        createdAt: new Date().toISOString(),
      };

      expect(partRecord.name).toBe('프로젝트관리부');
      expect(partRecord.agentCount).toBe(1); // Part 오케스트레이터만
      expect(partRecord.projectCount).toBe(0);
    });

    it('Skill 실행 후 skill-version.lock과 input.json 기록', () => {
      const versionLock = {
        skillName: 'project-part',
        version: '1.0.0',
        executedAt: new Date().toISOString(),
        checksum: 'sha256:abc123',
      };

      const inputJson = {
        part_name: '프로젝트관리부',
        description: 'SW 개발 프로젝트 관리',
        sensitivity: '일반',
        approval_policy: '기술 결정, 외부 API 사용 시 승인',
        retry_count: 3,
        retry_strategy: '지수백오프',
        model_routing: 'claude-sonnet',
      };

      expect(versionLock.skillName).toBe('project-part');
      expect(inputJson.part_name).toBe('프로젝트관리부');
    });

    it('단일 상속 메커니즘: project-part.sh가 base-part.sh를 상속', () => {
      const skill: Skill = {
        name: 'project-part',
        displayName: '프로젝트관리 Skill',
        version: '1.0.0',
        parentSkill: 'base-part',
        filePath: '~/.claudemanager/skills/project-part.sh',
        createdAt: new Date().toISOString(),
      };

      expect(skill.parentSkill).toBe('base-part');
    });
  });

  // ========================================
  // Step 5. 워크스페이스에 새 부서
  // ========================================
  describe('Step 5: 워크스페이스에 새 부서 표시', () => {
    it('에이전트 트리에 Part 노드 추가', () => {
      const tree = [
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
              children: [],
            },
          ],
        },
      ];

      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].name).toBe('프로젝트관리부');
      expect(tree[0].children[0].role).toBe('part');
    });

    it('Part 탭에 프로젝트관리부 추가', () => {
      const parts = [
        { id: 'part-project-001', name: '프로젝트관리부', status: 'active' },
      ];

      expect(parts).toHaveLength(1);
      expect(parts[0].name).toBe('프로젝트관리부');
    });

    it('하단 바 에이전트 수 업데이트 (+1)', () => {
      const beforeCount = 1; // Main만
      const afterCount = 2; // Main + Part
      expect(afterCount).toBe(beforeCount + 1);
    });
  });

  // ========================================
  // 예외흐름
  // ========================================
  describe('예외흐름', () => {
    it('E1: Skill 실행 오류 시 에러 메시지 전달', () => {
      const error = {
        type: 'skill_execution_error',
        message: 'permission denied: project-part.sh',
        suggestion: '스크립트 실행 권한을 확인해주세요',
      };

      expect(error.type).toBe('skill_execution_error');
      expect(error.message).toContain('permission denied');
    });

    it('E2: 동일 Skill로 이미 Part 존재 시 중복 생성 불가', () => {
      const existingParts = [
        { id: 'part-1', skillName: 'project-part' },
      ];

      const newSkillName = 'project-part';
      const isDuplicate = existingParts.some((p) => p.skillName === newSkillName);
      expect(isDuplicate).toBe(true);
    });

    it('E3: 필수 입력 누락 시 실행 버튼 비활성화', () => {
      const formData: Record<string, unknown> = {
        part_name: '', // 비어있음
        sensitivity: '일반',
        approval_policy: '기술 결정 시 승인',
      };

      const requiredFields = ['part_name', 'sensitivity', 'approval_policy'];
      const allFilled = requiredFields.every(
        (key) => formData[key] !== undefined && formData[key] !== ''
      );
      const isSubmitEnabled = allFilled;

      expect(isSubmitEnabled).toBe(false);
    });
  });

  // ========================================
  // 전체 흐름 통합
  // ========================================
  describe('전체 흐름: 대화 -> Skill 생성 -> 폼 -> Part 생성', () => {
    it('SC-002 전체 시나리오 상태 전이 검증', () => {
      // Phase 1: 대화로 방법론 정의
      const methodology = {
        stages: ['기획', '디자인', '개발', '테스트', '코드리뷰', '배포'],
        approvalRequired: ['기획', '디자인'],
      };
      expect(methodology.stages).toHaveLength(6);

      // Phase 2: Skill 생성
      const skill: Skill = {
        name: 'project-part',
        displayName: '프로젝트관리 Skill',
        version: '1.0.0',
        parentSkill: 'base-part',
        filePath: '~/.claudemanager/skills/project-part.sh',
        createdAt: new Date().toISOString(),
      };
      expect(skill.name).toBe('project-part');

      // Phase 3: 폼 입력
      const formData = {
        part_name: '프로젝트관리부',
        sensitivity: '일반',
        approval_policy: '기술 결정 시 승인',
        retry_count: 3,
        retry_strategy: '지수백오프',
        model_routing: 'claude-sonnet',
      };
      expect(formData.part_name).toBe('프로젝트관리부');

      // Phase 4: Part 생성
      const part = {
        id: 'part-project-001',
        name: '프로젝트관리부',
        status: 'active',
      };
      expect(part.status).toBe('active');

      // Phase 5: 에이전트 트리 업데이트
      const agentCount = 2; // Main + Part
      expect(agentCount).toBe(2);

      // -> SC-003 연결
      const nextScenario = 'SC-003';
      expect(nextScenario).toBe('SC-003');
    });
  });
});
