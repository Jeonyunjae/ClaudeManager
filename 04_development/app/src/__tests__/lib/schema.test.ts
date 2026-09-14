/**
 * schema.ts 단위 테스트
 * 대상 기능: 모든 DB 의존 기능 (F001~F075)
 * 시나리오 근거: 전체 - 17개 테이블 스키마 정의 검증
 * ERD.md 기반 검증
 */
import { describe, it, expect } from 'vitest';
import {
  users, agents, parts, skills, projects,
  chatMessages, approvals, approvalHistory,
  apiKeys, costRecords, notifications,
  auditLogs, agentLogs, partPolicies,
  settings, backups, systemHealth,
} from '@/lib/schema';

describe('schema.ts - 17 테이블 정의 검증', () => {
  // 각 테이블이 정의되어 있는지 확인 (import 에러 없이 로드되는지)
  it('users 테이블 정의', () => {
    expect(users).toBeDefined();
    expect(users.id).toBeDefined();
    expect(users.passwordHash).toBeDefined();
    expect(users.createdAt).toBeDefined();
    expect(users.updatedAt).toBeDefined();
  });

  it('agents 테이블 정의 (F008~F012)', () => {
    expect(agents).toBeDefined();
    expect(agents.id).toBeDefined();
    expect(agents.name).toBeDefined();
    expect(agents.role).toBeDefined();
    expect(agents.status).toBeDefined();
    expect(agents.partId).toBeDefined();
    expect(agents.parentId).toBeDefined();
    expect(agents.tmuxSession).toBeDefined();
    expect(agents.modelName).toBeDefined();
    expect(agents.modelProvider).toBeDefined();
    expect(agents.statusMessage).toBeDefined();
  });

  it('parts 테이블 정의 (F009)', () => {
    expect(parts).toBeDefined();
    expect(parts.id).toBeDefined();
    expect(parts.name).toBeDefined();
    expect(parts.skillName).toBeDefined();
    expect(parts.skillVersion).toBeDefined();
    expect(parts.sensitivityLevel).toBeDefined();
    expect(parts.status).toBeDefined();
  });

  it('skills 테이블 정의 (F001~F007)', () => {
    expect(skills).toBeDefined();
    expect(skills.id).toBeDefined();
    expect(skills.name).toBeDefined();
    expect(skills.displayName).toBeDefined();
    expect(skills.version).toBeDefined();
    expect(skills.filePath).toBeDefined();
    // bash 스킬 시절 컬럼(parentSkill: 단일 상속, schemaJson: schema 모드)은
    // 조합·bash 폐기로 의미가 사라져 0003 에서 제거됐다. 지금은 GitHub 저장소가
    // 진실 소스이고 이 테이블은 그 캐시다.
    expect(skills.category).toBeDefined();
    expect(skills.topics).toBeDefined();
    expect(skills.isPrivate).toBeDefined();
    expect(skills.repoUrl).toBeDefined();
    expect(skills.syncedAt).toBeDefined();
  });

  it('projects 테이블 정의 (F019~F021)', () => {
    expect(projects).toBeDefined();
    expect(projects.id).toBeDefined();
    expect(projects.name).toBeDefined();
    expect(projects.partId).toBeDefined();
    expect(projects.status).toBeDefined();
    expect(projects.priority).toBeDefined();
    expect(projects.progressPercent).toBeDefined();
  });

  it('chatMessages 테이블 정의 (F059~F060)', () => {
    expect(chatMessages).toBeDefined();
    expect(chatMessages.id).toBeDefined();
    expect(chatMessages.sender).toBeDefined();
    expect(chatMessages.content).toBeDefined();
    expect(chatMessages.messageType).toBeDefined();
  });

  it('approvals 테이블 정의 (F023~F027)', () => {
    expect(approvals).toBeDefined();
    expect(approvals.id).toBeDefined();
    expect(approvals.title).toBeDefined();
    expect(approvals.content).toBeDefined();
    expect(approvals.urgency).toBeDefined();
    expect(approvals.status).toBeDefined();
    expect(approvals.resolution).toBeDefined();
  });

  it('approvalHistory 테이블 정의 (F025)', () => {
    expect(approvalHistory).toBeDefined();
    expect(approvalHistory.id).toBeDefined();
    expect(approvalHistory.approvalId).toBeDefined();
    expect(approvalHistory.action).toBeDefined();
    expect(approvalHistory.actorType).toBeDefined();
  });

  it('apiKeys 테이블 정의 (F036~F039)', () => {
    expect(apiKeys).toBeDefined();
    expect(apiKeys.id).toBeDefined();
    expect(apiKeys.provider).toBeDefined();
    expect(apiKeys.keyEncrypted).toBeDefined();
    expect(apiKeys.keyIv).toBeDefined();
    expect(apiKeys.keyTag).toBeDefined();
    expect(apiKeys.keyMasked).toBeDefined();
    expect(apiKeys.status).toBeDefined();
    expect(apiKeys.expiresAt).toBeDefined();
  });

  it('costRecords 테이블 정의 (F046)', () => {
    expect(costRecords).toBeDefined();
    expect(costRecords.id).toBeDefined();
    expect(costRecords.agentId).toBeDefined();
    expect(costRecords.modelName).toBeDefined();
    expect(costRecords.inputTokens).toBeDefined();
    expect(costRecords.outputTokens).toBeDefined();
    expect(costRecords.cost).toBeDefined();
  });

  it('notifications 테이블 정의 (F028~F031)', () => {
    expect(notifications).toBeDefined();
    expect(notifications.id).toBeDefined();
    expect(notifications.type).toBeDefined();
    expect(notifications.title).toBeDefined();
    expect(notifications.message).toBeDefined();
    expect(notifications.isRead).toBeDefined();
  });

  it('auditLogs 테이블 정의 (F061~F063)', () => {
    expect(auditLogs).toBeDefined();
    expect(auditLogs.id).toBeDefined();
    expect(auditLogs.actorType).toBeDefined();
    expect(auditLogs.action).toBeDefined();
    expect(auditLogs.resource).toBeDefined();
  });

  it('agentLogs 테이블 정의 (F062)', () => {
    expect(agentLogs).toBeDefined();
    expect(agentLogs.id).toBeDefined();
    expect(agentLogs.agentId).toBeDefined();
    expect(agentLogs.eventType).toBeDefined();
    expect(agentLogs.inputTokens).toBeDefined();
    expect(agentLogs.outputTokens).toBeDefined();
    expect(agentLogs.cost).toBeDefined();
  });

  it('partPolicies 테이블 정의 (F027, F035, F065)', () => {
    expect(partPolicies).toBeDefined();
    expect(partPolicies.id).toBeDefined();
    expect(partPolicies.partId).toBeDefined();
    expect(partPolicies.retryCount).toBeDefined();
    expect(partPolicies.retryStrategy).toBeDefined();
    expect(partPolicies.retryIntervalBase).toBeDefined();
    expect(partPolicies.approvalStages).toBeDefined();
    expect(partPolicies.defaultModel).toBeDefined();
  });

  it('settings 테이블 정의 (F064)', () => {
    expect(settings).toBeDefined();
    expect(settings.key).toBeDefined();
    expect(settings.value).toBeDefined();
    expect(settings.updatedAt).toBeDefined();
  });

  it('backups 테이블 정의 (F068~F069)', () => {
    expect(backups).toBeDefined();
    expect(backups.id).toBeDefined();
    expect(backups.type).toBeDefined();
    expect(backups.status).toBeDefined();
    expect(backups.filePath).toBeDefined();
    expect(backups.sizeBytes).toBeDefined();
  });

  it('systemHealth 테이블 정의 (F017)', () => {
    expect(systemHealth).toBeDefined();
    expect(systemHealth.id).toBeDefined();
    expect(systemHealth.cpuPercent).toBeDefined();
    expect(systemHealth.memoryPercent).toBeDefined();
    expect(systemHealth.diskPercent).toBeDefined();
    expect(systemHealth.activeAgents).toBeDefined();
  });
});
