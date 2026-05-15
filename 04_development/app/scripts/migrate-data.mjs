/**
 * SQLite → PostgreSQL data migration script.
 *
 * Usage:
 *   DATABASE_URL=postgresql://claudemanager:claudemanager@127.0.0.1:5434/claudemanager \
 *   node scripts/migrate-data.mjs
 */

import Database from 'better-sqlite3';
import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SQLITE_PATH = path.join(__dirname, '..', 'data', 'claudemanager.db');
const PG_URL = process.env.DATABASE_URL;

if (!PG_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });
const pool = new pg.Pool({ connectionString: PG_URL });

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. users (serial PK — need to set sequence after insert)
    const users = sqlite.prepare('SELECT * FROM users').all();
    for (const u of users) {
      await client.query(
        `INSERT INTO users (id, password_hash, created_at, updated_at)
         VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
        [u.id, u.password_hash, u.created_at, u.updated_at]
      );
    }
    if (users.length > 0) {
      await client.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
    }
    console.log(`✓ users: ${users.length} rows`);

    // 2. settings (text PK)
    const settings = sqlite.prepare('SELECT * FROM settings').all();
    for (const s of settings) {
      await client.query(
        `INSERT INTO settings (key, value, updated_at)
         VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING`,
        [s.key, s.value, s.updated_at]
      );
    }
    console.log(`✓ settings: ${settings.length} rows`);

    // 3. agents (text PK, FK to parts — parts is empty so no issue)
    const agentRows = sqlite.prepare('SELECT * FROM agents').all();
    for (const a of agentRows) {
      await client.query(
        `INSERT INTO agents (id, name, role, status, part_id, parent_id, tmux_session, cli_session_id,
         model_name, model_provider, task_type, status_message, notes_path, started_at, stopped_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) ON CONFLICT (id) DO NOTHING`,
        [a.id, a.name, a.role, a.status, a.part_id || null, a.parent_id || null,
         a.tmux_session || null, a.cli_session_id || null, a.model_name || null,
         a.model_provider || null, a.task_type || null, a.status_message || null,
         a.notes_path || null, a.started_at || null, a.stopped_at || null,
         a.created_at, a.updated_at]
      );
    }
    console.log(`✓ agents: ${agentRows.length} rows`);

    // 4. api_keys (serial PK)
    const apiKeys = sqlite.prepare('SELECT * FROM api_keys').all();
    for (const k of apiKeys) {
      await client.query(
        `INSERT INTO api_keys (id, provider, key_encrypted, key_iv, key_tag, key_masked, status, expires_at, monthly_usage, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (id) DO NOTHING`,
        [k.id, k.provider, k.key_encrypted, k.key_iv, k.key_tag, k.key_masked,
         k.status, k.expires_at || null, k.monthly_usage || 0, k.created_at, k.updated_at]
      );
    }
    if (apiKeys.length > 0) {
      await client.query(`SELECT setval('api_keys_id_seq', (SELECT MAX(id) FROM api_keys))`);
    }
    console.log(`✓ api_keys: ${apiKeys.length} rows`);

    // 5. chat_messages (text PK)
    const chatMsgs = sqlite.prepare('SELECT * FROM chat_messages').all();
    for (const m of chatMsgs) {
      await client.query(
        `INSERT INTO chat_messages (id, sender, content, message_type, metadata, created_at)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
        [m.id, m.sender, m.content, m.message_type, m.metadata || null, m.created_at]
      );
    }
    console.log(`✓ chat_messages: ${chatMsgs.length} rows`);

    // 6. cost_records (serial PK, FK to agents, api_keys, projects)
    const costs = sqlite.prepare('SELECT * FROM cost_records').all();
    for (const c of costs) {
      await client.query(
        `INSERT INTO cost_records (id, agent_id, api_key_id, model_name, input_tokens, output_tokens, cost, project_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
        [c.id, c.agent_id || null, c.api_key_id || null, c.model_name,
         c.input_tokens, c.output_tokens, c.cost, c.project_id || null, c.created_at]
      );
    }
    if (costs.length > 0) {
      await client.query(`SELECT setval('cost_records_id_seq', (SELECT MAX(id) FROM cost_records))`);
    }
    console.log(`✓ cost_records: ${costs.length} rows`);

    // 7. audit_logs (serial PK)
    const audits = sqlite.prepare('SELECT * FROM audit_logs').all();
    for (const a of audits) {
      await client.query(
        `INSERT INTO audit_logs (id, actor_type, actor_id, action, resource, resource_id, detail, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [a.id, a.actor_type, a.actor_id || null, a.action, a.resource,
         a.resource_id || null, a.detail || null, a.created_at]
      );
    }
    if (audits.length > 0) {
      await client.query(`SELECT setval('audit_logs_id_seq', (SELECT MAX(id) FROM audit_logs))`);
    }
    console.log(`✓ audit_logs: ${audits.length} rows`);

    // 8. notifications (serial PK, is_read: integer 0/1 → boolean)
    const notifs = sqlite.prepare('SELECT * FROM notifications').all();
    for (const n of notifs) {
      await client.query(
        `INSERT INTO notifications (id, type, title, message, source_agent_id, target_url, is_read, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
        [n.id, n.type, n.title, n.message, n.source_agent_id || null,
         n.target_url || null, n.is_read === 1, n.created_at]
      );
    }
    if (notifs.length > 0) {
      await client.query(`SELECT setval('notifications_id_seq', (SELECT MAX(id) FROM notifications))`);
    }
    console.log(`✓ notifications: ${notifs.length} rows`);

    await client.query('COMMIT');
    console.log('\n✅ Data migration complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    sqlite.close();
  }
}

migrate();
