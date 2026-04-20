import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { NextRequest } from 'next/server';
import { JWT_EXPIRY_DAYS, PASSWORD_SALT_ROUNDS } from './constants';

const JWT_SECRET = process.env.JWT_SECRET || 'claudemanager-dev-secret-change-in-production';

export type JWTPayload = {
  userId: number;
  iat: number;
  exp: number;
};

export function generateToken(userId: number): string {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: `${JWT_EXPIRY_DAYS}d` }
  );
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function getAuthenticatedUserId(request: NextRequest): number | null {
  const token = extractToken(request);
  if (!token) return null;
  const payload = verifyToken(token);
  return payload?.userId ?? null;
}
