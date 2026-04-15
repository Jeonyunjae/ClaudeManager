import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// 2.1 users
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// 2.3 parts (before agents due to FK reference)
export const parts = sqliteTable('parts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  skillName: text('skill_name').notNull(),
  skillVersion: text('skill_version').notNull(),
  sensitivityLevel: text('sensitivity_level').notNull().default('normal'),
  modelProvider: text('model_provider'),
  color: text('color'),
  status: text('status').notNull().default('active'),
  inputJson: text('input_json'),
  orchestratorPath: text('orchestrator_path'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// 2.2 agents
export const agents = sqliteTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull().default('idle'),
  partId: text('part_id').references(() => parts.id),
  parentId: text('parent_id'),
  tmuxSession: text('tmux_session'),
  modelName: text('model_name'),
  modelProvider: text('model_provider'),
  taskType: text('task_type'),
  statusMessage: text('status_message'),
  startedAt: text('started_at'),
  stoppedAt: text('stopped_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_agents_part').on(table.partId),
  index('idx_agents_parent').on(table.parentId),
  index('idx_agents_status').on(table.status),
  index('idx_agents_role').on(table.role),
]);

// 2.4 skills
export const skills = sqliteTable('skills', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  version: text('version').notNull(),
  parentSkill: text('parent_skill'),
  schemaJson: text('schema_json'),
  filePath: text('file_path').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// 2.5 projects
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  partId: text('part_id').notNull().references(() => parts.id),
  subAgentId: text('sub_agent_id').references(() => agents.id),
  status: text('status').notNull().default('active'),
  currentStage: text('current_stage'),
  progressPercent: integer('progress_percent').default(0),
  priority: integer('priority').default(0),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_projects_part').on(table.partId),
  index('idx_projects_status').on(table.status),
]);

// 2.6 chat_messages
export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  sender: text('sender').notNull(),
  content: text('content').notNull(),
  messageType: text('message_type').notNull().default('text'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_chat_sender').on(table.sender),
  index('idx_chat_created').on(table.createdAt),
]);

// 2.7 approvals
export const approvals = sqliteTable('approvals', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  sourceAgentId: text('source_agent_id').references(() => agents.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  urgency: text('urgency').notNull().default('normal'),
  status: text('status').notNull().default('pending'),
  resolution: text('resolution'),
  resolvedAt: text('resolved_at'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_approvals_status').on(table.status),
  index('idx_approvals_project').on(table.projectId),
  index('idx_approvals_created').on(table.createdAt),
]);

// 2.8 approval_history
export const approvalHistory = sqliteTable('approval_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  approvalId: text('approval_id').notNull().references(() => approvals.id),
  action: text('action').notNull(),
  comment: text('comment'),
  actorType: text('actor_type').notNull(),
  actorId: text('actor_id'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_approval_hist_approval').on(table.approvalId),
]);

// 2.9 api_keys
export const apiKeys = sqliteTable('api_keys', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  provider: text('provider').notNull(),
  keyEncrypted: text('key_encrypted').notNull(),
  keyIv: text('key_iv').notNull(),
  keyTag: text('key_tag').notNull(),
  keyMasked: text('key_masked').notNull(),
  status: text('status').notNull().default('active'),
  expiresAt: text('expires_at'),
  monthlyUsage: real('monthly_usage').default(0),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// 2.10 cost_records
export const costRecords = sqliteTable('cost_records', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  agentId: text('agent_id').references(() => agents.id),
  apiKeyId: integer('api_key_id').references(() => apiKeys.id),
  modelName: text('model_name').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  cost: real('cost').notNull(),
  projectId: text('project_id').references(() => projects.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_cost_agent').on(table.agentId),
  index('idx_cost_model').on(table.modelName),
  index('idx_cost_project').on(table.projectId),
  index('idx_cost_created').on(table.createdAt),
]);

// 2.11 notifications
export const notifications = sqliteTable('notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  sourceAgentId: text('source_agent_id').references(() => agents.id),
  targetUrl: text('target_url'),
  isRead: integer('is_read', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_notif_type').on(table.type),
  index('idx_notif_read').on(table.isRead),
  index('idx_notif_created').on(table.createdAt),
]);

// 2.12 audit_logs
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorType: text('actor_type').notNull(),
  actorId: text('actor_id'),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  detail: text('detail'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_audit_actor').on(table.actorType),
  index('idx_audit_action').on(table.action),
  index('idx_audit_resource').on(table.resource),
  index('idx_audit_created').on(table.createdAt),
]);

// 2.13 agent_logs
export const agentLogs = sqliteTable('agent_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  agentId: text('agent_id').notNull().references(() => agents.id),
  eventType: text('event_type').notNull(),
  message: text('message'),
  detail: text('detail'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cost: real('cost'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_agent_logs_agent').on(table.agentId),
  index('idx_agent_logs_event').on(table.eventType),
  index('idx_agent_logs_created').on(table.createdAt),
]);

// 2.14 part_policies
export const partPolicies = sqliteTable('part_policies', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  partId: text('part_id').notNull().references(() => parts.id).unique(),
  retryCount: integer('retry_count').notNull().default(3),
  retryStrategy: text('retry_strategy').notNull().default('exponential'),
  retryIntervalBase: integer('retry_interval_base').notNull().default(10),
  approvalStages: text('approval_stages'),
  defaultModel: text('default_model'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// 2.15 settings
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
});

// 2.16 backups
export const backups = sqliteTable('backups', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  type: text('type').notNull(),
  status: text('status').notNull(),
  filePath: text('file_path'),
  sizeBytes: integer('size_bytes'),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});

// 2.17 system_health
export const systemHealth = sqliteTable('system_health', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  cpuPercent: real('cpu_percent').notNull(),
  memoryPercent: real('memory_percent').notNull(),
  diskPercent: real('disk_percent').notNull(),
  networkUpMbps: real('network_up_mbps'),
  networkDownMbps: real('network_down_mbps'),
  activeAgents: integer('active_agents').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
}, (table) => [
  index('idx_health_created').on(table.createdAt),
]);
