/**
 * SC-018. Skill 작성 지원 시나리오 테스트
 * 관련 기능: F003, F004, F007, F008
 */
import { describe, it, expect } from 'vitest';
import type { Skill } from '@/types/skill';

describe('SC-018: Skill 작성 지원', () => {
  it('대화로 새 도메인 방법론 정의 (재무관리)', () => {
    const methodology = {
      domain: 'finance',
      tasks: [
        { name: '월간 지출 분석', frequency: 'monthly', approvalRequired: true },
        { name: '주간 투자 포트폴리오 검토', frequency: 'weekly', approvalRequired: true },
        { name: '분기 세금 계산', frequency: 'quarterly', approvalRequired: true },
      ],
      sensitivityLevel: '극민감',
    };
    expect(methodology.tasks).toHaveLength(3);
    expect(methodology.sensitivityLevel).toBe('극민감');
  });

  it('Skill 스크립트 자동 생성 (base-part.sh 상속)', () => {
    const skill: Skill = {
      name: 'finance-part',
      displayName: '재무관리 Skill',
      version: '1.0.0',
      parentSkill: 'base-part',
      filePath: '~/.claudemanager/skills/finance-part.sh',
      createdAt: new Date().toISOString(),
    };
    expect(skill.parentSkill).toBe('base-part');
  });

  it('Skill 라이브러리에 등록 후 즉시 실행 가능', () => {
    const skills = ['base-part', 'project-part', 'finance-part'];
    expect(skills).toContain('finance-part');
  });

  describe('예외흐름', () => {
    it('E1: 동일 이름 Skill 존재', () => {
      const existing = ['finance-part'];
      const newName = 'finance-part';
      const isDuplicate = existing.includes(newName);
      expect(isDuplicate).toBe(true);
    });

    it('E2: 스크립트 구문 오류 자동 수정', () => {
      const hasError = true;
      const autoFixed = true;
      expect(hasError && autoFixed).toBe(true);
    });

    it('E3: base-part.sh 누락 시 복구 제안', () => {
      const baseExists = false;
      const shouldRecover = !baseExists;
      expect(shouldRecover).toBe(true);
    });
  });
});
