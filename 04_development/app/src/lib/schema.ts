import { pgTable, text, integer, doublePrecision, serial, boolean, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 2.1 users
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
  updatedAt: text('updated_at').notNull().default(sql`now()::text`),
});

// 2.3 parts (before agents due to FK reference)
export const parts = pgTable('parts', {
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
  createdAt: text('created_at').notNull().default(sql`now()::text`),
  updatedAt: text('updated_at').notNull().default(sql`now()::text`),
});

// 2.2 agents
export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull().default('idle'),
  partId: text('part_id').references(() => parts.id),
  parentId: text('parent_id'),
  tmuxSession: text('tmux_session'),
  cliSessionId: text('cli_session_id'),
  modelName: text('model_name'),
  modelProvider: text('model_provider'),
  taskType: text('task_type'),
  statusMessage: text('status_message'),
  notesPath: text('notes_path'),
  projectRoot: text('project_root'),
  startedAt: text('started_at'),
  stoppedAt: text('stopped_at'),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
  updatedAt: text('updated_at').notNull().default(sql`now()::text`),
}, (table) => [
  index('idx_agents_part').on(table.partId),
  index('idx_agents_parent').on(table.parentId),
  index('idx_agents_status').on(table.status),
  index('idx_agents_role').on(table.role),
]);

// 2.4 skills
export const skills = pgTable('skills', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description'),
  version: text('version').notNull(),
  parentSkill: text('parent_skill'),
  schemaJson: text('schema_json'),
  filePath: text('file_path').notNull(),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
  updatedAt: text('updated_at').notNull().default(sql`now()::text`),
});

// 2.5 projects
export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  partId: text('part_id').notNull().references(() => parts.id),
  subAgentId: text('sub_agent_id').references(() => agents.id),
  status: text('status').notNull().default('active'),
  currentStage: text('current_stage'),
  progressPercent: integer('progress_percent').default(0),
  priority: text('priority').notNull().default('normal'), // 'urgent' | 'high' | 'normal' | 'low'
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
  updatedAt: text('updated_at').notNull().default(sql`now()::text`),
}, (table) => [
  index('idx_projects_part').on(table.partId),
  index('idx_projects_status').on(table.status),
  index('idx_projects_priority').on(table.priority),
]);

// 2.6 chat_messages
export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey(),
  sender: text('sender').notNull(),
  content: text('content').notNull(),
  messageType: text('message_type').notNull().default('text'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
}, (table) => [
  index('idx_chat_sender').on(table.sender),
  index('idx_chat_created').on(table.createdAt),
]);

// 2.7 approvals
export const approvals = pgTable('approvals', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  sourceAgentId: text('source_agent_id').references(() => agents.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  urgency: text('urgency').notNull().default('normal'),
  status: text('status').notNull().default('pending'),
  resolution: text('resolution'),
  resolvedAt: text('resolved_at'),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
}, (table) => [
  index('idx_approvals_status').on(table.status),
  index('idx_approvals_project').on(table.projectId),
  index('idx_approvals_created').on(table.createdAt),
]);

// 2.8 approval_history
export const approvalHistory = pgTable('approval_history', {
  id: serial('id').primaryKey(),
  approvalId: text('approval_id').notNull().references(() => approvals.id),
  action: text('action').notNull(),
  comment: text('comment'),
  actorType: text('actor_type').notNull(),
  actorId: text('actor_id'),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
}, (table) => [
  index('idx_approval_hist_approval').on(table.approvalId),
]);

// 2.9 api_keys
export const apiKeys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  provider: text('provider').notNull(),
  keyEncrypted: text('key_encrypted').notNull(),
  keyIv: text('key_iv').notNull(),
  keyTag: text('key_tag').notNull(),
  keyMasked: text('key_masked').notNull(),
  status: text('status').notNull().default('active'),
  expiresAt: text('expires_at'),
  monthlyUsage: doublePrecision('monthly_usage').default(0),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
  updatedAt: text('updated_at').notNull().default(sql`now()::text`),
});

// 2.10 cost_records
export const costRecords = pgTable('cost_records', {
  id: serial('id').primaryKey(),
  agentId: text('agent_id').references(() => agents.id),
  apiKeyId: integer('api_key_id').references(() => apiKeys.id),
  modelName: text('model_name').notNull(),
  inputTokens: integer('input_tokens').notNull(),
  outputTokens: integer('output_tokens').notNull(),
  cost: doublePrecision('cost').notNull(),
  projectId: text('project_id').references(() => projects.id),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
}, (table) => [
  index('idx_cost_agent').on(table.agentId),
  index('idx_cost_model').on(table.modelName),
  index('idx_cost_project').on(table.projectId),
  index('idx_cost_created').on(table.createdAt),
]);

// 2.11 notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  sourceAgentId: text('source_agent_id').references(() => agents.id),
  targetUrl: text('target_url'),
  isRead: boolean('is_read').default(false),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
}, (table) => [
  index('idx_notif_type').on(table.type),
  index('idx_notif_read').on(table.isRead),
  index('idx_notif_created').on(table.createdAt),
]);

// 2.12 audit_logs
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  actorType: text('actor_type').notNull(),
  actorId: text('actor_id'),
  action: text('action').notNull(),
  resource: text('resource').notNull(),
  resourceId: text('resource_id'),
  detail: text('detail'),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
}, (table) => [
  index('idx_audit_actor').on(table.actorType),
  index('idx_audit_action').on(table.action),
  index('idx_audit_resource').on(table.resource),
  index('idx_audit_created').on(table.createdAt),
]);

// 2.13 agent_logs
export const agentLogs = pgTable('agent_logs', {
  id: serial('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id),
  eventType: text('event_type').notNull(),
  message: text('message'),
  detail: text('detail'),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cost: doublePrecision('cost'),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
}, (table) => [
  index('idx_agent_logs_agent').on(table.agentId),
  index('idx_agent_logs_event').on(table.eventType),
  index('idx_agent_logs_created').on(table.createdAt),
]);

// 2.14 part_policies
export const partPolicies = pgTable('part_policies', {
  id: serial('id').primaryKey(),
  partId: text('part_id').notNull().references(() => parts.id).unique(),
  retryCount: integer('retry_count').notNull().default(3),
  retryStrategy: text('retry_strategy').notNull().default('exponential'),
  retryIntervalBase: integer('retry_interval_base').notNull().default(10),
  approvalStages: text('approval_stages'),
  defaultModel: text('default_model'),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
  updatedAt: text('updated_at').notNull().default(sql`now()::text`),
});

// 2.15 settings
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`now()::text`),
});

// 2.16 backups
export const backups = pgTable('backups', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  filePath: text('file_path'),
  sizeBytes: integer('size_bytes'),
  errorMessage: text('error_message'),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
});

// 2.17 system_health
export const systemHealth = pgTable('system_health', {
  id: serial('id').primaryKey(),
  cpuPercent: doublePrecision('cpu_percent').notNull(),
  memoryPercent: doublePrecision('memory_percent').notNull(),
  diskPercent: doublePrecision('disk_percent').notNull(),
  networkUpMbps: doublePrecision('network_up_mbps'),
  networkDownMbps: doublePrecision('network_down_mbps'),
  activeAgents: integer('active_agents').notNull(),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
}, (table) => [
  index('idx_health_created').on(table.createdAt),
]);

// 2.18 agent_checkpoints
export const agentCheckpoints = pgTable('agent_checkpoints', {
  id: serial('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id),
  projectId: text('project_id').references(() => projects.id),
  currentStage: text('current_stage').notNull(),
  completedTasks: text('completed_tasks'),
  pendingTasks: text('pending_tasks'),
  contextSnapshot: text('context_snapshot'),
  lastOutputHash: text('last_output_hash'),
  metadata: text('metadata'),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
}, (table) => [
  index('idx_checkpoint_agent').on(table.agentId),
  index('idx_checkpoint_project').on(table.projectId),
  index('idx_checkpoint_created').on(table.createdAt),
]);

// 2.19 message_queue
export const messageQueue = pgTable('message_queue', {
  id: text('id').primaryKey(),
  fromAgentId: text('from_agent_id').references(() => agents.id),
  toAgentId: text('to_agent_id').references(() => agents.id),
  content: text('content').notNull(),
  messageType: text('message_type').notNull(),
  status: text('status').notNull().default('created'),
  retryCount: integer('retry_count').default(0),
  maxRetries: integer('max_retries').default(3),
  lastRetryAt: text('last_retry_at'),
  errorDetail: text('error_detail'),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
  updatedAt: text('updated_at').notNull().default(sql`now()::text`),
}, (table) => [
  index('idx_mq_status').on(table.status),
  index('idx_mq_from').on(table.fromAgentId),
  index('idx_mq_to').on(table.toAgentId),
  index('idx_mq_created').on(table.createdAt),
]);

// 2.20 execution_queue
export const executionQueue = pgTable('execution_queue', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  agentId: text('agent_id').references(() => agents.id),
  taskDescription: text('task_description').notNull(),
  priority: text('priority').notNull().default('normal'),
  status: text('status').notNull().default('queued'),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  result: text('result'),
  createdAt: text('created_at').notNull().default(sql`now()::text`),
}, (table) => [
  index('idx_eq_priority').on(table.priority),
  index('idx_eq_status').on(table.status),
  index('idx_eq_project').on(table.projectId),
]);
