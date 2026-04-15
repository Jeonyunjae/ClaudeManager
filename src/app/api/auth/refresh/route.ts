import { NextRequest, NextResponse } from 'next/server';
import { extractToken, verifyToken, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const token = extractToken(request);
    if (!token) {
      return NextResponse.json(
        { error: { code: 'AUTH_TOKEN_EXPIRED', message: '인증 토큰이 없습니다.' } },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json(
        { error: { code: 'AUTH_TOKEN_EXPIRED', message: '토큰이 만료되었습니다.' } },
        { status: 401 }
      );
    }

    const newToken = generateToken(payload.userId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    return NextResponse.json({ data: { token: newToken, expiresAt } });
  } catch (error) {
    console.error('Refresh error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
