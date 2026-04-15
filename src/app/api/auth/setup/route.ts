import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { users } from '@/lib/schema';
import { hashPassword, generateToken } from '@/lib/auth';
import { eq, count } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password, confirmPassword } = body;

    if (!password || !confirmPassword) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_REQUIRED', message: '비밀번호를 입력해주세요.' } },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_PASSWORD_MISMATCH', message: '비밀번호가 일치하지 않습니다.' } },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_INVALID_FORMAT', message: '비밀번호는 4자 이상이어야 합니다.' } },
        { status: 400 }
      );
    }

    // Check if already set up
    const [userCount] = await db.select({ count: count() }).from(users);
    if (userCount.count > 0) {
      return NextResponse.json(
        { error: { code: 'AUTH_ALREADY_SETUP', message: '이미 설정이 완료되었습니다.' } },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);
    const result = await db.insert(users).values({ passwordHash }).returning();
    const token = generateToken(result[0].id);

    return NextResponse.json({ data: { token } }, { status: 201 });
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: { code: 'SYSTEM_ERROR', message: '서버 오류가 발생했습니다.' } },
      { status: 500 }
    );
  }
}
