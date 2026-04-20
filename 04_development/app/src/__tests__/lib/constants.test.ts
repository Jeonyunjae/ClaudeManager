/**
 * constants.ts 단위 테스트
 * 대상 기능: 전체 시스템 상수 검증 (F059 인증, F032 재시도, F070 동시 실행 등)
 * 시나리오 근거: SC-001 (인증 상수), SC-006 (재시도 상수), SC-016 (동시 실행 상수)
 */
import { describe, it, expect } from 'vitest';
import {
  APP_NAME, APP_VERSION,
  JWT_EXPIRY_DAYS, PASSWORD_SALT_ROUNDS, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_SECONDS,
  WS_PORT, WS_RECONNECT_INITIAL_MS, WS_RECONNECT_MAX_MS,
  DEFAULT_PAGE_SIZE, CHAT_PAGE_SIZE,
  DEFAULT_RETRY_COUNT, DEFAULT_RETRY_INTERVAL_BASE,
  DEFAULT_COST_LIMIT, DEFAULT_ALERT_THRESHOLD,
  DEFAULT_MAX_CONCURRENT_AGENTS,
  BACKUP_RETENTION_DAYS,
  AGENT_ROLES, AGENT_STATUSES,
  BREAKPOINTS,
  ERROR_CODES,
} from '@/lib/constants';

describe('constants.ts - 앱 상수', () => {
  it('앱 이름과 버전 정의', () => {
    expect(APP_NAME).toBe('ClaudeManager');
    expect(APP_VERSION).toBe('0.1.0');
  });
});

describe('constants.ts - 인증 상수 (SC-001)', () => {
  it('JWT 만료일 7일', () => {
    expect(JWT_EXPIRY_DAYS).toBe(7);
  });

  it('비밀번호 salt rounds 12', () => {
    expect(PASSWORD_SALT_ROUNDS).toBe(12);
  });

  it('최대 로그인 시도 5회 (E1: 계정 잠금)', () => {
    expect(MAX_LOGIN_ATTEMPTS).toBe(5);
  });

  it('잠금 시간 30초', () => {
    expect(LOCKOUT_DURATION_SECONDS).toBe(30);
  });
});

describe('constants.ts - WebSocket 상수', () => {
  it('WS 포트 3001', () => {
    expect(WS_PORT).toBe(3001);
  });

  it('재연결 초기 딜레이 1초', () => {
    expect(WS_RECONNECT_INITIAL_MS).toBe(1000);
  });

  it('재연결 최대 딜레이 30초', () => {
    expect(WS_RECONNECT_MAX_MS).toBe(30000);
  });
});

describe('constants.ts - 페이지네이션 상수', () => {
  it('기본 페이지 크기 20', () => {
    expect(DEFAULT_PAGE_SIZE).toBe(20);
  });

  it('채팅 페이지 크기 50', () => {
    expect(CHAT_PAGE_SIZE).toBe(50);
  });
});

describe('constants.ts - 재시도 상수 (SC-006)', () => {
  it('기본 재시도 횟수 3', () => {
    expect(DEFAULT_RETRY_COUNT).toBe(3);
  });

  it('기본 재시도 간격 10초', () => {
    expect(DEFAULT_RETRY_INTERVAL_BASE).toBe(10);
  });
});

describe('constants.ts - 비용 상수 (SC-007)', () => {
  it('기본 비용 한도 100 USD', () => {
    expect(DEFAULT_COST_LIMIT).toBe(100);
  });

  it('알림 임계치 80%', () => {
    expect(DEFAULT_ALERT_THRESHOLD).toBe(80);
  });
});

describe('constants.ts - 에이전트 상수 (SC-016)', () => {
  it('기본 최대 동시 에이전트 10', () => {
    expect(DEFAULT_MAX_CONCURRENT_AGENTS).toBe(10);
  });
});

describe('constants.ts - 에이전트 역할/상태 enum (SC-003)', () => {
  it('에이전트 4계층 역할 정의', () => {
    expect(AGENT_ROLES.MAIN).toBe('main');
    expect(AGENT_ROLES.PART).toBe('part');
    expect(AGENT_ROLES.SUB).toBe('sub');
    expect(AGENT_ROLES.INSTANCE).toBe('instance');
  });

  it('에이전트 6가지 상태 정의', () => {
    expect(AGENT_STATUSES.ACTIVE).toBe('active');
    expect(AGENT_STATUSES.IDLE).toBe('idle');
    expect(AGENT_STATUSES.PENDING).toBe('pending');
    expect(AGENT_STATUSES.ERROR).toBe('error');
    expect(AGENT_STATUSES.STOPPED).toBe('stopped');
    expect(AGENT_STATUSES.RETRYING).toBe('retrying');
  });
});

describe('constants.ts - 브레이크포인트 (SC-025)', () => {
  it('모바일 768px, 데스크톱 1024px', () => {
    expect(BREAKPOINTS.MOBILE).toBe(768);
    expect(BREAKPOINTS.DESKTOP).toBe(1024);
  });
});

describe('constants.ts - 에러 코드 체계', () => {
  it('AUTH 에러 코드 정의', () => {
    expect(ERROR_CODES.AUTH_INVALID_PASSWORD).toBe('AUTH_INVALID_PASSWORD');
    expect(ERROR_CODES.AUTH_TOKEN_EXPIRED).toBe('AUTH_TOKEN_EXPIRED');
    expect(ERROR_CODES.AUTH_LOCKED).toBe('AUTH_LOCKED');
    expect(ERROR_CODES.AUTH_ALREADY_SETUP).toBe('AUTH_ALREADY_SETUP');
  });

  it('AGENT 에러 코드 정의', () => {
    expect(ERROR_CODES.AGENT_NOT_FOUND).toBe('AGENT_NOT_FOUND');
  });

  it('SKILL 에러 코드 정의', () => {
    expect(ERROR_CODES.SKILL_NOT_FOUND).toBe('SKILL_NOT_FOUND');
    expect(ERROR_CODES.SKILL_SCHEMA_INVALID).toBe('SKILL_SCHEMA_INVALID');
    expect(ERROR_CODES.SKILL_EXECUTION_FAILED).toBe('SKILL_EXECUTION_FAILED');
  });

  it('APPROVAL 에러 코드 정의', () => {
    expect(ERROR_CODES.APPROVAL_NOT_FOUND).toBe('APPROVAL_NOT_FOUND');
    expect(ERROR_CODES.APPROVAL_ALREADY_RESOLVED).toBe('APPROVAL_ALREADY_RESOLVED');
  });

  it('VALIDATION 에러 코드 정의', () => {
    expect(ERROR_CODES.VALIDATION_REQUIRED).toBe('VALIDATION_REQUIRED');
    expect(ERROR_CODES.VALIDATION_INVALID_FORMAT).toBe('VALIDATION_INVALID_FORMAT');
    expect(ERROR_CODES.VALIDATION_PASSWORD_MISMATCH).toBe('VALIDATION_PASSWORD_MISMATCH');
  });

  it('SYSTEM 에러 코드 정의', () => {
    expect(ERROR_CODES.SYSTEM_BACKUP_FAILED).toBe('SYSTEM_BACKUP_FAILED');
    expect(ERROR_CODES.SYSTEM_RESTORE_FAILED).toBe('SYSTEM_RESTORE_FAILED');
  });
});

describe('constants.ts - 백업 상수 (SC-015)', () => {
  it('백업 보관 기간 30일', () => {
    expect(BACKUP_RETENTION_DAYS).toBe(30);
  });
});
