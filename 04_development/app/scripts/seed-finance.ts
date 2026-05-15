/**
 * Seed Finance Part + Finance Sub into ClaudeManager DB.
 * Idempotent — uses ON CONFLICT DO UPDATE so re-runs are safe.
 * Run: npx tsx --env-file=.env.local scripts/seed-finance.ts
 */
import { Pool } from 'pg';

const PART_ID = 'part_finance';
const SUB_ID = 'agent_finance_sub';
const MAIN_ID = 'main-001';

const PART = {
  id: PART_ID,
  name: '개인 투자',
  description: '국내 기관 수급 추종 · 섹터 로테이션 기반 투자 분석 Part',
  skill_name: 'finance-investment-skill',
  skill_version: 'v1.3',
  sensitivity_level: 'normal',
  color: '#34D399',
  status: 'active',
};

const SUB = {
  id: SUB_ID,
  name: 'Finance Sub',
  role: 'sub',
  status: 'active',
  part_id: PART_ID,
  parent_id: MAIN_ID, // attach under Main so it is a child in the tree
  tmux_session: 'finance-sub',
  status_message: 'FS1·FS2·FS3 병행 착수 중 (52주 고점 · 섹터 PER×EPS · 섹터 수급)',
  notes_path: '/Users/jeon-yunjae/Documents/윤재 자료 정리/04.Project/07. Finance Bot',
};

async function main() {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://claudemanager:claudemanager@127.0.0.1:5433/claudemanager';
  const pool = new Pool({ connectionString });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Upsert Part
    const partRes = await client.query(
      `INSERT INTO parts (id, name, description, skill_name, skill_version, sensitivity_level, color, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         skill_name = EXCLUDED.skill_name,
         skill_version = EXCLUDED.skill_version,
         sensitivity_level = EXCLUDED.sensitivity_level,
         color = EXCLUDED.color,
         status = EXCLUDED.status,
         updated_at = now()::text
       RETURNING id, name, skill_name, skill_version, color, status`,
      [
        PART.id,
        PART.name,
        PART.description,
        PART.skill_name,
        PART.skill_version,
        PART.sensitivity_level,
        PART.color,
        PART.status,
      ]
    );

    // Verify Main exists (for parent_id FK-less reference).
    const mainCheck = await client.query(
      `SELECT id, name FROM agents WHERE id = $1`,
      [MAIN_ID]
    );
    const parentId = mainCheck.rows.length > 0 ? SUB.parent_id : null;

    // Upsert Sub agent
    const nowSql = `now()::text`;
    const agentRes = await client.query(
      `INSERT INTO agents (id, name, role, status, part_id, parent_id, tmux_session, status_message, notes_path, started_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, ${nowSql})
       ON CONFLICT (id) DO UPDATE SET
         name = EXCLUDED.name,
         role = EXCLUDED.role,
         status = EXCLUDED.status,
         part_id = EXCLUDED.part_id,
         parent_id = EXCLUDED.parent_id,
         tmux_session = EXCLUDED.tmux_session,
         status_message = EXCLUDED.status_message,
         notes_path = EXCLUDED.notes_path,
         updated_at = now()::text
       RETURNING id, name, role, status, part_id, parent_id, tmux_session`,
      [
        SUB.id,
        SUB.name,
        SUB.role,
        SUB.status,
        SUB.part_id,
        parentId,
        SUB.tmux_session,
        SUB.status_message,
        SUB.notes_path,
      ]
    );

    await client.query('COMMIT');

    console.log('[OK] Part upserted:');
    console.table(partRes.rows);
    console.log('[OK] Sub agent upserted:');
    console.table(agentRes.rows);
    if (mainCheck.rows.length === 0) {
      console.warn(
        `[WARN] Main agent id=${MAIN_ID} not found — Sub created without parent_id.`
      );
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[ERR] Seed failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
