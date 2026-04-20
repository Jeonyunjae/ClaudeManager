/**
 * Seed script: Insert demo data matching dashboard-prototype.html
 * Run: npx tsx scripts/seed-demo.ts
 */
import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const DB_DIR = process.env.CLAUDEMANAGER_HOME
  ? path.join(process.env.CLAUDEMANAGER_HOME, 'data')
  : path.join(process.cwd(), 'data');

const DB_PATH = path.join(DB_DIR, 'claudemanager.db');
const sqlite = new Database(DB_PATH);
sqlite.pragma('foreign_keys = ON');

// IDs
const mainAgentId = uuidv4();
const devPartId = uuidv4();
const designPartId = uuidv4();
const qaPartId = uuidv4();
const devAgentId = uuidv4();
const designAgentId = uuidv4();
const qaAgentId = uuidv4();
const feSubId = uuidv4();
const beSubId = uuidv4();
const inst1Id = uuidv4();
const inst2Id = uuidv4();
const inst3Id = uuidv4();

const now = new Date().toISOString();
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

sqlite.exec('BEGIN');

try {
  // ── Parts ──
  const insertPart = sqlite.prepare(
    `INSERT OR IGNORE INTO parts (id, name, description, skill_name, skill_version, color, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertPart.run(devPartId, 'Dev Part', 'Development Team', 'development', '1.0.0', '#6366F1', 'active', now, now);
  insertPart.run(designPartId, 'Design Part', 'UI/UX Design', 'design', '1.0.0', '#E8606D', 'active', now, now);
  insertPart.run(qaPartId, 'QA Part', 'Quality Assurance', 'qa', '1.0.0', '#34D399', 'active', now, now);

  // ── Agents ──
  const insertAgent = sqlite.prepare(
    `INSERT OR IGNORE INTO agents (id, name, role, status, part_id, parent_id, model_name, status_message, started_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  // Main agent
  insertAgent.run(mainAgentId, 'Main', 'main', 'active', null, null, 'claude-opus-4', 'Project Orchestrator', hoursAgo(8), now, now);

  // Part agents
  insertAgent.run(devAgentId, 'Dev Part', 'part', 'active', devPartId, mainAgentId, 'claude-sonnet-4', 'Development Team', hoursAgo(6), now, now);
  insertAgent.run(designAgentId, 'Design Part', 'part', 'pending', designPartId, mainAgentId, 'claude-sonnet-4', 'UI/UX Design', hoursAgo(5), now, now);
  insertAgent.run(qaAgentId, 'QA Part', 'part', 'active', qaPartId, mainAgentId, 'claude-sonnet-4', 'Quality Assurance', hoursAgo(4), now, now);

  // Sub agents (under Dev Part)
  insertAgent.run(feSubId, 'Frontend Project', 'sub', 'active', devPartId, devAgentId, 'claude-sonnet-4', 'Dashboard UI Implementation', hoursAgo(3), now, now);
  insertAgent.run(beSubId, 'Backend Project', 'sub', 'pending', devPartId, devAgentId, 'claude-sonnet-4', 'API & Database', hoursAgo(2), now, now);

  // Instance agents (under Frontend Project)
  insertAgent.run(inst1Id, 'Component Builder', 'instance', 'active', devPartId, feSubId, 'claude-sonnet-4', 'Building card components', hoursAgo(1), now, now);
  insertAgent.run(inst2Id, 'Layout Agent', 'instance', 'idle', devPartId, feSubId, 'claude-sonnet-4', 'Page layout setup', hoursAgo(2), now, now);
  insertAgent.run(inst3Id, 'State Manager', 'instance', 'active', devPartId, feSubId, 'claude-haiku-4-5', 'Zustand store setup', hoursAgo(1), now, now);

  // ── Projects ──
  const insertProject = sqlite.prepare(
    `INSERT OR IGNORE INTO projects (id, name, part_id, sub_agent_id, status, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertProject.run(uuidv4(), 'Frontend Project', devPartId, feSubId, 'active', 'high', now, now);
  insertProject.run(uuidv4(), 'Backend Project', devPartId, beSubId, 'active', 'normal', now, now);

  // ── Approvals (pending) ──
  const insertApproval = sqlite.prepare(
    `INSERT OR IGNORE INTO approvals (id, project_id, source_agent_id, title, content, urgency, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insertApproval.run(uuidv4(), null, designAgentId, 'UI prototype review approval', 'Design Part has completed the initial UI prototype and requests review before proceeding.', 'normal', 'pending', hoursAgo(2));
  insertApproval.run(uuidv4(), null, devAgentId, 'API endpoint design review', 'Dev Part requests approval for the proposed API endpoint structure.', 'normal', 'pending', hoursAgo(4));
  insertApproval.run(uuidv4(), null, devAgentId, 'Database schema confirmation', 'Dev Part requests confirmation of the database schema design.', 'normal', 'pending', hoursAgo(5));

  // ── Notifications (activity log) ──
  const insertNotif = sqlite.prepare(
    `INSERT OR IGNORE INTO notifications (type, title, message, source_agent_id, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  insertNotif.run('active', 'Working', 'Building CardHeader component', inst1Id, 0, hoursAgo(0.5));
  insertNotif.run('approval', 'Approval', 'UI prototype review requested', designAgentId, 0, hoursAgo(1));
  insertNotif.run('complete', 'Complete', 'Dashboard layout completed', inst2Id, 0, hoursAgo(2));
  insertNotif.run('active', 'Dispatch', 'Assigned API design to Backend', mainAgentId, 1, hoursAgo(4));

  sqlite.exec('COMMIT');
  console.log('Demo data seeded successfully!');
  console.log(`  Main agent: ${mainAgentId}`);
  console.log(`  Parts: Dev(${devPartId}), Design(${designPartId}), QA(${qaPartId})`);
  console.log(`  Subs: FE(${feSubId}), BE(${beSubId})`);
  console.log(`  Instances: 3`);
  console.log(`  Approvals: 3 pending`);
  console.log(`  Notifications: 4`);
} catch (err) {
  sqlite.exec('ROLLBACK');
  console.error('Seed failed:', err);
  process.exit(1);
}

sqlite.close();
