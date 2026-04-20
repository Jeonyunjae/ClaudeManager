import { NextResponse } from 'next/server';
import { getQueueStatus } from '@/lib/execution-queue';

export async function GET() {
  try {
    const status = await getQueueStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Failed to get execution status' } },
      { status: 500 }
    );
  }
}
