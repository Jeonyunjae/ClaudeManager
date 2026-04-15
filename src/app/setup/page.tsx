'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { useAuthStore } from '@/stores/authStore';

export default function SetupPage() {
  const router = useRouter();
  const { setup, isAuthenticated, isLoading, error } = useAuthStore();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/workspace');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await setup(password, confirmPassword);
  };

  const passwordMatch = password === confirmPassword;
  const isValid = password.length >= 4 && passwordMatch;

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[var(--primary-50)] via-[var(--bg-base)] to-[var(--secondary-50)]">
      <Card className="w-full max-w-md mx-4">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="h-16 w-16 rounded-[var(--radius-xl)] bg-[var(--primary-500)] flex items-center justify-center">
              <span className="text-2xl font-bold text-white">CM</span>
            </div>
          </div>
          <CardTitle className="text-2xl">초기 설정</CardTitle>
          <CardDescription>ClaudeManager 비밀번호를 설정해주세요</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)] mb-1 block">비밀번호</label>
              <Input
                type="password"
                placeholder="비밀번호 (4자 이상)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium text-[var(--text-primary)] mb-1 block">비밀번호 확인</label>
              <Input
                type="password"
                placeholder="비밀번호를 한 번 더 입력"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {confirmPassword && !passwordMatch && (
                <p className="text-xs text-[var(--status-error-text)] mt-1">비밀번호가 일치하지 않습니다</p>
              )}
            </div>
            {/* Password strength indicator */}
            {password && (
              <div className="flex gap-1">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-colors ${
                      password.length >= level * 2
                        ? level <= 2 ? 'bg-[var(--status-error)]' : level === 3 ? 'bg-[var(--status-pending)]' : 'bg-[var(--status-complete)]'
                        : 'bg-[var(--primary-100)]'
                    }`}
                  />
                ))}
              </div>
            )}
            {error && (
              <p className="text-sm text-[var(--status-error-text)]">{error}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading || !isValid}>
              {isLoading ? '설정 중...' : '설정 완료'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
