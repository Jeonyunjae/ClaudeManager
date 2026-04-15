import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { users } from '@/lib/schema';
import { comparePassword, generateToken } from '@/lib/auth';
import { MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_SECONDS } from '@/lib/constants';

// Simple in-memory login attempt tracking
const loginAttempts: Map<string, { count: number; lockedUntil?: number }> = new Map();

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'local';
    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_REQUIRED', message: '비밀번호를 입력해주세요.' } },
        { status: 400 }
      );
    }

    // Check lockout
    const attempts = loginAttempts.get(ip);
    if (attempts?.lockedUntil && Date.now() < attempts.lockedUntil) {
      const remainingSec = Math.ceil((attempts.lockedUntil - Date.now()) / 1000);
      return NextResponse.json(
        { error: { code: 'AUTH_LOCKED', message: `${remainingSec}초 후에 다시 시도해주세요.` } },
        { status: 429 }
      );
    }

    // Get user
    const allUsers = await db.select().from(users).limit(1);
    if (allUsers.length === 0) {
      return NextResponse.json(
        { error: { code: 'AUTH_NOT_SETUP', message: '초기 설정이 필요합니다.' } },
        { status: 400 }
      );
    }

    const user = allUsers[0];
    const isValid = await comparePassword(password, user.passwordHash);

    if (!isValid) {
      const current = loginAttempts.get(ip) || { count: 0 };
      current.count += 1;
      if (current.count >= MAX_LOGIN_ATTEMPTS) {
        current.lockedUntil = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
        current.count = 0;
      }
      loginAttempts.set(ip, current);

      return NextResponse.json(
        { error: { code: 'AUTH_INVALID_PASSWORD', message: '비밀번호가 올바르지 않습니다.' } },
        { status: 401 }
      );
    }

    // Reset attempts on success
    loginAttempts.delete(ip);

    const token = generateToken(user.id);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    return NextResponse.json({ data: { token, expiresAt } });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
