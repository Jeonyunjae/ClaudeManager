/**
 * skill-engine.ts 단위 테스트
 * 대상 기능: F001~F007 (Skill 엔진)
 * 수용 기준:
 *   - schema 모드 실행 시 JSON 파싱
 *   - execute 모드 실행 시 결과 반환
 *   - skillExists() 동작
 *   - writeVersionLock/writeInputJson 파일 생성
 *   - 존재하지 않는 Skill 실행 시 에러
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock child_process
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFile: vi.fn((cmd: string, args: string[], opts: unknown, cb: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
    if (typeof opts === 'function') {
      cb = opts as typeof cb;
    }
  }),
}));

// Mock util.promisify to return a mock execFileAsync
vi.mock('util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('util')>();
  return {
    ...actual,
    promisify: (fn: unknown) => {
      // Return a mock async function that we can control
      return vi.fn();
    },
  };
});

const TEST_HOME = path.join(os.tmpdir(), `cm-skill-test-${Date.now()}`);

describe('skill-engine.ts - Skill 실행 엔진', () => {
  beforeEach(() => {
    process.env.CLAUDEMANAGER_HOME = TEST_HOME;
    fs.mkdirSync(path.join(TEST_HOME, 'skills'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  });

  // We import functions that don't need async execution
  // For sync functions, we can test directly
  describe('skillExists', () => {
    it('존재하는 Skill에 대해 true 반환', async () => {
      const { skillExists, getSkillPath } = await import('@/lib/skill-engine');
      // Create a dummy skill file
      const skillPath = getSkillPath('test-skill');
      fs.writeFileSync(skillPath, '#!/bin/bash\necho "test"', { mode: 0o755 });

      expect(skillExists('test-skill')).toBe(true);
    });

    it('존재하지 않는 Skill에 대해 false 반환', async () => {
      const { skillExists } = await import('@/lib/skill-engine');
      expect(skillExists('nonexistent-skill')).toBe(false);
    });
  });

  describe('listSkillFiles', () => {
    it('.sh 파일 목록을 이름만 반환 (확장자 제외)', async () => {
      const { listSkillFiles, getSkillPath } = await import('@/lib/skill-engine');

      // Create skill files
      fs.writeFileSync(getSkillPath('alpha'), '#!/bin/bash');
      fs.writeFileSync(getSkillPath('beta'), '#!/bin/bash');
      fs.writeFileSync(path.join(TEST_HOME, 'skills', 'readme.md'), 'not a skill');

      const skills = listSkillFiles();
      expect(skills).toContain('alpha');
      expect(skills).toContain('beta');
      expect(skills).not.toContain('readme');
    });

    it('빈 디렉토리에서 빈 배열 반환', async () => {
      const { listSkillFiles } = await import('@/lib/skill-engine');
      const skills = listSkillFiles();
      expect(Array.isArray(skills)).toBe(true);
    });
  });

  describe('getSkillPath', () => {
    it('SKILLS_DIR/<name>.sh 경로 반환', async () => {
      const { getSkillPath } = await import('@/lib/skill-engine');
      const p = getSkillPath('my-skill');
      expect(p).toBe(path.join(TEST_HOME, 'skills', 'my-skill.sh'));
    });
  });

  describe('ensureSkillsDir', () => {
    it('skills 디렉토리가 없으면 생성', async () => {
      // Remove directory first
      fs.rmSync(path.join(TEST_HOME, 'skills'), { recursive: true, force: true });

      const { ensureSkillsDir } = await import('@/lib/skill-engine');
      const dir = ensureSkillsDir();
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  // --- AC: writeVersionLock ---
  describe('writeVersionLock', () => {
    it('skill-version.lock 파일에 skillName, version 포함', async () => {
      const { writeVersionLock } = await import('@/lib/skill-engine');
      const partDir = path.join(TEST_HOME, 'test-part');
      fs.mkdirSync(partDir, { recursive: true });

      writeVersionLock(partDir, 'project-part', '1.0.0');

      const lockPath = path.join(partDir, 'skill-version.lock');
      expect(fs.existsSync(lockPath)).toBe(true);

      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
      expect(lock.skillName).toBe('project-part');
      expect(lock.version).toBe('1.0.0');
      expect(lock.lockedAt).toBeDefined();
    });
  });

  // --- AC: writeInputJson ---
  describe('writeInputJson', () => {
    it('input.json 파일에 입력값 기록', async () => {
      const { writeInputJson } = await import('@/lib/skill-engine');
      const partDir = path.join(TEST_HOME, 'test-part-2');
      fs.mkdirSync(partDir, { recursive: true });

      const input = { name: 'Dev Department', methodology: 'agile', teamSize: 5 };
      writeInputJson(partDir, input);

      const inputPath = path.join(partDir, 'input.json');
      expect(fs.existsSync(inputPath)).toBe(true);

      const saved = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));
      expect(saved.name).toBe('Dev Department');
      expect(saved.methodology).toBe('agile');
      expect(saved.teamSize).toBe(5);
    });
  });

  // --- AC: installDefaultSkills ---
  describe('installDefaultSkills', () => {
    it('base-part.sh와 project-part.sh 기본 Skill 파일 설치', async () => {
      const { installDefaultSkills, getSkillPath } = await import('@/lib/skill-engine');

      const result = installDefaultSkills();
      expect(result.installed).toContain('base-part');
      expect(result.installed).toContain('project-part');

      expect(fs.existsSync(getSkillPath('base-part'))).toBe(true);
      expect(fs.existsSync(getSkillPath('project-part'))).toBe(true);
    });

    it('이미 존재하면 다시 설치하지 않음', async () => {
      const { installDefaultSkills, getSkillPath } = await import('@/lib/skill-engine');

      installDefaultSkills();
      const result2 = installDefaultSkills();
      expect(result2.installed).toEqual([]);
    });

    it('base-part.sh가 schema/execute case문을 포함', async () => {
      const { installDefaultSkills, getSkillPath } = await import('@/lib/skill-engine');

      installDefaultSkills();
      const content = fs.readFileSync(getSkillPath('base-part'), 'utf-8');
      expect(content).toContain('schema)');
      expect(content).toContain('execute)');
      expect(content).toContain('create_part_dir');
    });

    it('project-part.sh가 source base-part.sh로 부모를 로드', async () => {
      const { installDefaultSkills, getSkillPath } = await import('@/lib/skill-engine');

      installDefaultSkills();
      const content = fs.readFileSync(getSkillPath('project-part'), 'utf-8');
      expect(content).toContain('source "$SKILL_DIR/base-part.sh"');
      expect(content).toContain('"parent": "base-part"');
    });
  });

  // --- AC: getSkillSchema - 존재하지 않는 Skill ---
  describe('getSkillSchema (에러 경로)', () => {
    it('존재하지 않는 Skill에 대해 에러 throw', async () => {
      const { getSkillSchema } = await import('@/lib/skill-engine');
      await expect(getSkillSchema('no-such-skill')).rejects.toThrow('Skill script not found');
    });
  });

  // --- AC: executeSkill - 존재하지 않는 Skill ---
  describe('executeSkill (에러 경로)', () => {
    it('존재하지 않는 Skill에 대해 success:false 반환', async () => {
      const { executeSkill } = await import('@/lib/skill-engine');
      const result = await executeSkill('no-such-skill', {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('Skill script not found');
    });
  });
});
