import { and, eq } from 'drizzle-orm';
import db from '../lib/db';
import { agents } from '../lib/schema';
import type { InstanceStore } from './instance-tracker';

/** InstanceTracker가 쓰는 DB 저장소 (BUG-034) */
export const dbInstanceStore: InstanceStore = {
  insert: async (row) => {
    await db.insert(agents).values({ ...row });
  },
  update: async (id, fields) => {
    await db.update(agents).set({ ...fields, updatedAt: new Date().toISOString() }).where(eq(agents.id, id));
  },
};

/**
 * 서버가 Instance 실행 중에 꺼졌다 켜지면 'active'로 남은 행이 생긴다 — 기동 시 '중단'으로 닫는다.
 * @returns 닫은 행 수
 */
export async function closeStaleInstances(): Promise<number> {
  const now = new Date().toISOString();
  const rows = await db
    .update(agents)
    .set({ status: 'stopped', stoppedAt: now, updatedAt: now })
    .where(and(eq(agents.role, 'instance'), eq(agents.status, 'active')))
    .returning({ id: agents.id });
  return rows.length;
}
