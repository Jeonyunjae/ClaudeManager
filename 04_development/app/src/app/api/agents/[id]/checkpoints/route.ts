import { NextRequest, NextResponse } from 'next/server';
import { getCheckpoints, saveCheckpoint, getLatestCheckpoint } from '@/lib/checkpoint-manager';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const checkpoints = await getCheckpoints(id);
    return NextResponse.json(checkpoints);
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Failed to fetch checkpoints' } },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const checkpointId = await saveCheckpoint({
      agentId: id,
      projectId: body.projectId,
      currentStage: body.currentStage || 'unknown',
      completedTasks: body.completedTasks || [],
      pendingTasks: body.pendingTasks || [],
      contextSnapshot: body.contextSnapshot,
      lastOutputHash: body.lastOutputHash,
      metadata: body.metadata,
    });

    return NextResponse.json({ id: checkpointId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: 'Failed to save checkpoint' } },
      { status: 500 }
    );
  }
}
