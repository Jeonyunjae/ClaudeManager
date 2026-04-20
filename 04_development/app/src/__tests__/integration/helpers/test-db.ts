/**
 * Integration test helper: in-memory SQLite + Drizzle ORM
 * Creates a fresh DB per test suite for isolated integration tests.
 */
import Database from 'better-sqlite3';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '@/lib/schema';

export type TestDB = BetterSQLite3Database<typeof schema>;

export function createTestDB(): { db: TestDB; sqlite: InstanceType<typeof Database> } {
  const sqlite = new Database(':memory:');
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });

  // Create all tables
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      skill_name TEXT NOT NULL,
      skill_version TEXT NOT NULL,
      sensitivity_level TEXT NOT NULL DEFAULT 'normal',
      model_provider TEXT,
      color TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      input_json TEXT,
      orchestrator_path TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      part_id TEXT REFERENCES parts(id),
      parent_id TEXT,
      tmux_session TEXT,
      model_name TEXT,
      model_provider TEXT,
      task_type TEXT,
      status_message TEXT,
      started_at TEXT,
      stopped_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_agents_part ON agents(part_id);
    CREATE INDEX IF NOT EXISTS idx_agents_parent ON agents(parent_id);
    CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);
    CREATE INDEX IF NOT EXISTS idx_agents_role ON agents(role);

    CREATE TABLE IF NOT EXISTS skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT,
      version TEXT NOT NULL,
      parent_skill TEXT,
      schema_json TEXT,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      part_id TEXT NOT NULL REFERENCES parts(id),
      sub_agent_id TEXT REFERENCES agents(id),
      status TEXT NOT NULL DEFAULT 'active',
      current_stage TEXT,
      progress_percent INTEGER DEFAULT 0,
      priority TEXT NOT NULL DEFAULT 'normal',
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_projects_part ON projects(part_id);
    CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
    CREATE INDEX IF NOT EXISTS idx_projects_priority ON projects(priority);

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      sender TEXT NOT NULL,
      content TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'text',
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender);
    CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_messages(created_at);

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      source_agent_id TEXT REFERENCES agents(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      urgency TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'pending',
      resolution TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_approvals_status ON approvals(status);
    CREATE INDEX IF NOT EXISTS idx_approvals_project ON approvals(project_id);
    CREATE INDEX IF NOT EXISTS idx_approvals_created ON approvals(created_at);

    CREATE TABLE IF NOT EXISTS approval_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      approval_id TEXT NOT NULL REFERENCES approvals(id),
      action TEXT NOT NULL,
      comment TEXT,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_approval_hist_approval ON approval_history(approval_id);

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      key_encrypted TEXT NOT NULL,
      key_iv TEXT NOT NULL,
      key_tag TEXT NOT NULL,
      key_masked TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      expires_at TEXT,
      monthly_usage REAL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cost_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT REFERENCES agents(id),
      api_key_id INTEGER REFERENCES api_keys(id),
      model_name TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost REAL NOT NULL,
      project_id TEXT REFERENCES projects(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_cost_agent ON cost_records(agent_id);
    CREATE INDEX IF NOT EXISTS idx_cost_model ON cost_records(model_name);
    CREATE INDEX IF NOT EXISTS idx_cost_project ON cost_records(project_id);
    CREATE INDEX IF NOT EXISTS idx_cost_created ON cost_records(created_at);

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      source_agent_id TEXT REFERENCES agents(id),
      target_url TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notif_type ON notifications(type);
    CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_notif_created ON notifications(created_at);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_type TEXT NOT NULL,
      actor_id TEXT,
      action TEXT NOT NULL,
      resource TEXT NOT NULL,
      resource_id TEXT,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_type);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
    CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

    CREATE TABLE IF NOT EXISTS agent_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      event_type TEXT NOT NULL,
      message TEXT,
      detail TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      cost REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_agent_logs_agent ON agent_logs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_logs_event ON agent_logs(event_type);
    CREATE INDEX IF NOT EXISTS idx_agent_logs_created ON agent_logs(created_at);

    CREATE TABLE IF NOT EXISTS part_policies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      part_id TEXT NOT NULL UNIQUE REFERENCES parts(id),
      retry_count INTEGER NOT NULL DEFAULT 3,
      retry_strategy TEXT NOT NULL DEFAULT 'exponential',
      retry_interval_base INTEGER NOT NULL DEFAULT 10,
      approval_stages TEXT,
      default_model TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      file_path TEXT,
      size_bytes INTEGER,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS system_health (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cpu_percent REAL NOT NULL,
      memory_percent REAL NOT NULL,
      disk_percent REAL NOT NULL,
      network_up_mbps REAL,
      network_down_mbps REAL,
      active_agents INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_health_created ON system_health(created_at);

    CREATE TABLE IF NOT EXISTS agent_checkpoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL REFERENCES agents(id),
      project_id TEXT REFERENCES projects(id),
      current_stage TEXT NOT NULL,
      completed_tasks TEXT,
      pending_tasks TEXT,
      context_snapshot TEXT,
      last_output_hash TEXT,
      metadata TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_checkpoint_agent ON agent_checkpoints(agent_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoint_project ON agent_checkpoints(project_id);
    CREATE INDEX IF NOT EXISTS idx_checkpoint_created ON agent_checkpoints(created_at);

    CREATE TABLE IF NOT EXISTS message_queue (
      id TEXT PRIMARY KEY,
      from_agent_id TEXT REFERENCES agents(id),
      to_agent_id TEXT REFERENCES agents(id),
      content TEXT NOT NULL,
      message_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'created',
      retry_count INTEGER DEFAULT 0,
      max_retries INTEGER DEFAULT 3,
      last_retry_at TEXT,
      error_detail TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_mq_status ON message_queue(status);
    CREATE INDEX IF NOT EXISTS idx_mq_from ON message_queue(from_agent_id);
    CREATE INDEX IF NOT EXISTS idx_mq_to ON message_queue(to_agent_id);
    CREATE INDEX IF NOT EXISTS idx_mq_created ON message_queue(created_at);

    CREATE TABLE IF NOT EXISTS execution_queue (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      agent_id TEXT REFERENCES agents(id),
      task_description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'queued',
      started_at TEXT,
      completed_at TEXT,
      result TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_eq_priority ON execution_queue(priority);
    CREATE INDEX IF NOT EXISTS idx_eq_status ON execution_queue(status);
    CREATE INDEX IF NOT EXISTS idx_eq_project ON execution_queue(project_id);
  `);

  return { db, sqlite };
}

export function closeTestDB(sqlite: InstanceType<typeof Database>): void {
  sqlite.close();
}
