import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { projects } from '@/lib/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  try {
    const rows = db
      .select()
      .from(projects)
      .orderBy(
        sql`CASE ${projects.priority}
          WHEN 'urgent' THEN 0
          WHEN 'high' THEN 1
          WHEN 'normal' THEN 2
          WHEN 'low' THEN 3
          ELSE 4
        END`,
        sql`${projects.createdAt} DESC`
      )
      ;

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Failed to fetch projects' } },
      { status: 500 }
    );
  }
}
