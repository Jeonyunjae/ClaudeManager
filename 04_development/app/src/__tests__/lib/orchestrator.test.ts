/**
 * orchestrator.ts 단위 테스트
 * 대상 기능: F008~F012 (4계층 오케스트레이션)
 * 수용 기준:
 *   - tmux 세션 생성 함수가 올바른 명령어를 구성하는지
 *   - .orchestrator/ 폴더 구조 생성 확인
 *   - Hooks 설정 파일 생성 확인
 *   - 세션 kill/list/send-keys 동작 확인
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock child_process before importing orchestrator
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFile: vi.fn(),
}));

import { execSync } from 'child_process';
const mockedExecSync = vi.mocked(execSync);

// Set up temp dir for tests
const TEST_HOME = path.join(os.tmpdir(), `cm-orch-test-${Date.now()}`);
process.env.CLAUDEMANAGER_HOME = TEST_HOME;

// Must re-import after env setup — use dynamic import
let orchestrator: typeof import('@/lib/orchestrator');

describe('orchestrator.ts - tmux 세션 관리 및 폴더 구조', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Create temp directories
    fs.mkdirSync(TEST_HOME, { recursive: true });
    // Re-import to pick up env changes
    orchestrator = await import('@/lib/orchestrator');
  });

  afterEach(() => {
    fs.rmSync(TEST_HOME, { recursive: true, force: true });
  });

  // --- AC: buildSessionName ---
  describe('buildSessionName', () => {
    it('main 역할에 대해 cm-main-<id8> 형식의 세션명 생성', () => {
      const name = orchestrator.buildSessionName('main', 'abcdefgh-1234-5678');
      expect(name).toBe('cm-main-abcdefgh');
    });

    it('part 역할에 대해 cm-part-<id8> 형식의 세션명 생성', () => {
      const name = orchestrator.buildSessionName('part', 'xyz12345-9999');
      expect(name).toBe('cm-part-xyz12345');
    });

    it('sub 역할에 대해 올바른 prefix 적용', () => {
      const name = orchestrator.buildSessionName('sub', 'sub-agent-id-long');
      expect(name).toBe('cm-sub-sub-agen');
    });

    it('instance 역할에 대해 올바른 prefix 적용', () => {
      const name = orchestrator.buildSessionName('instance', 'inst0001-xxxx');
      expect(name).toBe('cm-instance-inst0001');
    });
  });

  // --- AC: .orchestrator/ 폴더 구조 생성 ---
  describe('createPartFolderStructure', () => {
    it('.orchestrator/<partId> 하위에 sub-contexts, decisions, progress 디렉토리 생성', () => {
      const partDir = orchestrator.createPartFolderStructure('part-001', 'Test Part');

      expect(fs.existsSync(partDir)).toBe(true);
      expect(fs.existsSync(path.join(partDir, 'sub-contexts'))).toBe(true);
      expect(fs.existsSync(path.join(partDir, 'decisions'))).toBe(true);
      expect(fs.existsSync(path.join(partDir, 'progress'))).toBe(true);
    });

    it('main-context.md 파일이 Part 이름과 ID를 포함하여 생성', () => {
      const partDir = orchestrator.createPartFolderStructure('part-002', 'My Department');
      const contextPath = path.join(partDir, 'main-context.md');

      expect(fs.existsSync(contextPath)).toBe(true);
      const content = fs.readFileSync(contextPath, 'utf-8');
      expect(content).toContain('My Department');
      expect(content).toContain('part-002');
      expect(content).toContain('Status: active');
    });

    it('이미 존재하는 폴더에 대해 중복 생성하지 않음', () => {
      orchestrator.createPartFolderStructure('part-003', 'First');
      const partDir = orchestrator.createPartFolderStructure('part-003', 'Second');
      // main-context.md should still have the original name
      const content = fs.readFileSync(path.join(partDir, 'main-context.md'), 'utf-8');
      expect(content).toContain('First');
    });
  });

  // --- AC: Sub context 생성 ---
  describe('createSubContext', () => {
    it('sub-contexts/<subId>.md 파일 생성', () => {
      orchestrator.createPartFolderStructure('part-010', 'Parent Part');
      const filePath = orchestrator.createSubContext('part-010', 'sub-001', 'Sub Agent');

      expect(fs.existsSync(filePath)).toBe(true);
      const content = fs.readFileSync(filePath, 'utf-8');
      expect(content).toContain('Sub Agent');
      expect(content).toContain('sub-001');
      expect(content).toContain('part-010');
    });
  });

  // --- AC: ensureOrchestratorDir ---
  describe('ensureOrchestratorDir', () => {
    it('.orchestrator 디렉토리가 없으면 생성', () => {
      const dir = orchestrator.ensureOrchestratorDir();
      expect(fs.existsSync(dir)).toBe(true);
    });
  });

  // --- AC: Hooks 설정 파일 생성 ---
  describe('setupHooks', () => {
    it('프로젝트 디렉토리에 .claude/settings.json 생성', () => {
      const projectDir = path.join(TEST_HOME, 'test-project');
      fs.mkdirSync(projectDir, { recursive: true });

      orchestrator.setupHooks(projectDir, 'agent-abc');

      const settingsPath = path.join(projectDir, '.claude', 'settings.json');
      expect(fs.existsSync(settingsPath)).toBe(true);

      const config = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      expect(config.hooks).toBeDefined();
      expect(config.hooks.PostToolUse).toBeDefined();
      expect(config.hooks.Stop).toBeDefined();
    });

    it('Hooks 설정에 agentId와 API URL이 포함', () => {
      const projectDir = path.join(TEST_HOME, 'test-project-2');
      fs.mkdirSync(projectDir, { recursive: true });

      orchestrator.setupHooks(projectDir, 'my-agent-id');

      const settingsPath = path.join(projectDir, '.claude', 'settings.json');
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      expect(raw).toContain('my-agent-id');
      expect(raw).toContain('/api/hooks/event');
    });

    it('기존 settings.json이 있으면 병합', () => {
      const projectDir = path.join(TEST_HOME, 'test-project-3');
      const claudeDir = path.join(projectDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(
        path.join(claudeDir, 'settings.json'),
        JSON.stringify({ existingKey: 'value' }),
        'utf-8'
      );

      orchestrator.setupHooks(projectDir, 'agent-xyz');

      const config = JSON.parse(
        fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf-8')
      );
      expect(config.existingKey).toBe('value');
      expect(config.hooks).toBeDefined();
    });
  });

  // --- AC: tmux 세션 CRUD (mock 기반) ---
  describe('createSession', () => {
    it('tmux new-session 명령어를 실행', () => {
      // sessionExists returns false (no sessions)
      mockedExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('has-session')) {
          throw new Error('session not found');
        }
        return '' as unknown as Buffer;
      });

      const result = orchestrator.createSession('cm-main-test1234');
      expect(result.success).toBe(true);
      expect(result.sessionName).toBe('cm-main-test1234');
    });

    it('workDir가 있으면 -c 옵션 추가', () => {
      const workDir = path.join(TEST_HOME, 'work');
      fs.mkdirSync(workDir, { recursive: true });

      mockedExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('has-session')) {
          throw new Error('session not found');
        }
        return '' as unknown as Buffer;
      });

      orchestrator.createSession('cm-part-testwork', workDir);

      // Verify that new-session was called with -c flag
      const calls = mockedExecSync.mock.calls;
      const newSessionCall = calls.find(
        (c) => typeof c[0] === 'string' && c[0].includes('new-session') && c[0].includes('-c')
      );
      expect(newSessionCall).toBeDefined();
    });
  });

  describe('killSession', () => {
    it('존재하지 않는 세션에 대해 성공 반환', () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('has-session')) {
          throw new Error('session not found');
        }
        return '' as unknown as Buffer;
      });

      const result = orchestrator.killSession('cm-nonexistent');
      expect(result.success).toBe(true);
    });
  });

  describe('sendKeys', () => {
    it('존재하지 않는 세션에 대해 에러 반환', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('session not found');
      });

      const result = orchestrator.sendKeys('cm-no-session', 'echo hello');
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('listSessions', () => {
    it('tmux 서버 미실행 시 빈 배열 반환', () => {
      mockedExecSync.mockImplementation(() => {
        throw new Error('no server running');
      });

      const sessions = orchestrator.listSessions();
      expect(sessions).toEqual([]);
    });

    it('cm- prefix가 있는 세션만 필터링', () => {
      mockedExecSync.mockReturnValue(
        'cm-main-abc|2024-01-01|1|1\nother-session|2024-01-01|0|1\ncm-part-xyz|2024-01-01|0|2' as unknown as Buffer
      );

      const sessions = orchestrator.listSessions();
      expect(sessions.length).toBe(2);
      expect(sessions[0].name).toBe('cm-main-abc');
      expect(sessions[1].name).toBe('cm-part-xyz');
    });
  });

  // --- AC: 고수준 오케스트레이션 ---
  describe('startPart', () => {
    it('폴더 구조 생성 + tmux 세션 생성', () => {
      mockedExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('has-session')) {
          throw new Error('not found');
        }
        return '' as unknown as Buffer;
      });

      const result = orchestrator.startPart('part-100', 'Dev Department', 'agent-100');
      expect(result.success).toBe(true);
      expect(result.sessionName).toContain('cm-part-');

      // Verify folder was created
      const orchDir = path.join(TEST_HOME, '.orchestrator', 'part-100');
      expect(fs.existsSync(orchDir)).toBe(true);
    });
  });

  describe('startSub', () => {
    it('sub-context 파일 생성 + tmux 세션 생성', () => {
      orchestrator.createPartFolderStructure('part-200', 'Parent');

      mockedExecSync.mockImplementation((cmd: string) => {
        if (typeof cmd === 'string' && cmd.includes('has-session')) {
          throw new Error('not found');
        }
        return '' as unknown as Buffer;
      });

      const result = orchestrator.startSub('part-200', 'sub-200', 'Sub Worker', 'agent-200');
      expect(result.success).toBe(true);

      const subFile = path.join(TEST_HOME, '.orchestrator', 'part-200', 'sub-contexts', 'sub-200.md');
      expect(fs.existsSync(subFile)).toBe(true);
    });
  });
});
