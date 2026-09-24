// Application constants

export const APP_NAME = 'ClaudeManager';
export const APP_VERSION = '0.1.0';

// Auth
export const JWT_EXPIRY_DAYS = 7;
export const PASSWORD_SALT_ROUNDS = 12;
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCKOUT_DURATION_SECONDS = 30;
// 토큰 만료까지 남은 기간이 이 값(일) 이하이면 앱 진입 시 자동 갱신한다 (NFR-003)
export const TOKEN_REFRESH_THRESHOLD_DAYS = 2;

// WebSocket
export const WS_PORT = 3001;
export const WS_RECONNECT_INITIAL_MS = 1000;
export const WS_RECONNECT_MAX_MS = 30000;

// Pagination
export const DEFAULT_PAGE_SIZE = 20;
export const CHAT_PAGE_SIZE = 50;

// Retry
export const DEFAULT_RETRY_COUNT = 3;
export const DEFAULT_RETRY_INTERVAL_BASE = 10; // seconds

// Cost
export const DEFAULT_COST_LIMIT = 100; // USD
export const DEFAULT_ALERT_THRESHOLD = 80; // percentage

// Agent
export const DEFAULT_MAX_CONCURRENT_AGENTS = 10;

// Backup
export const BACKUP_RETENTION_DAYS = 30;
export const AUTO_BACKUP_CRON = '0 3 * * *'; // 3 AM daily

// Data retention
export const AGENT_LOGS_RETENTION_DAYS = 90;
export const SYSTEM_HEALTH_RETENTION_DAYS = 30;
export const NOTIFICATION_RETENTION_DAYS = 90;

// Agent roles
export const AGENT_ROLES = {
  MAIN: 'main',
  PART: 'part',
  SUB: 'sub',
  INSTANCE: 'instance',
} as const;

// Agent statuses
export const AGENT_STATUSES = {
  ACTIVE: 'active',
  IDLE: 'idle',
  PENDING: 'pending',
  ERROR: 'error',
  STOPPED: 'stopped',
  RETRYING: 'retrying',
} as const;

// Breakpoints
export const BREAKPOINTS = {
  MOBILE: 768,
  DESKTOP: 1024,
} as const;

// API error codes
export const ERROR_CODES = {
  AUTH_INVALID_PASSWORD: 'AUTH_INVALID_PASSWORD',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_LOCKED: 'AUTH_LOCKED',
  AUTH_ALREADY_SETUP: 'AUTH_ALREADY_SETUP',
  AGENT_NOT_FOUND: 'AGENT_NOT_FOUND',
  SKILL_NOT_FOUND: 'SKILL_NOT_FOUND',
  SKILL_SCHEMA_INVALID: 'SKILL_SCHEMA_INVALID',
  SKILL_EXECUTION_FAILED: 'SKILL_EXECUTION_FAILED',
  PART_NOT_FOUND: 'PART_NOT_FOUND',
  APPROVAL_NOT_FOUND: 'APPROVAL_NOT_FOUND',
  APPROVAL_ALREADY_RESOLVED: 'APPROVAL_ALREADY_RESOLVED',
  VALIDATION_REQUIRED: 'VALIDATION_REQUIRED',
  VALIDATION_INVALID_FORMAT: 'VALIDATION_INVALID_FORMAT',
  VALIDATION_PASSWORD_MISMATCH: 'VALIDATION_PASSWORD_MISMATCH',
  SYSTEM_BACKUP_FAILED: 'SYSTEM_BACKUP_FAILED',
  SYSTEM_RESTORE_FAILED: 'SYSTEM_RESTORE_FAILED',
} as const;
