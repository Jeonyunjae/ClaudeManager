'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useViewMode } from '@/hooks/useViewMode';

function getPasswordStrength(pw: string): { level: number; text: string; hint: string } {
  if (!pw) return { level: 0, text: '', hint: '' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[a-zA-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 1, text: '약함', hint: '영문+숫자+특수문자를 포함하세요' };
  if (score === 2) return { level: 2, text: '보통', hint: '특수문자를 추가하세요' };
  if (score === 3) return { level: 3, text: '좋음', hint: '거의 다 됐어요' };
  return { level: 4, text: '강함', hint: '영문+숫자+특수문자 포함' };
}

function getSegmentColor(segIndex: number, level: number): string {
  if (segIndex >= level) return 'var(--bg-content-card)';
  if (level === 1) return 'var(--status-error)';
  if (level === 2 || level === 3) return 'var(--status-pending)';
  return '#34D399';
}

function getStrengthTextColor(level: number): string {
  if (level <= 1) return 'var(--status-error)';
  if (level <= 3) return 'var(--status-pending)';
  return '#34D399';
}

export default function SetupPage() {
  const router = useRouter();
  const { setup, isAuthenticated, isLoading, error } = useAuthStore();
  const { shouldUseMobile } = useViewMode();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      // DF-006: /workspace(폐기된 Phase 2 3D 화면)로 가지 않는다.
      // 폭<768이면 /m/chat, 아니면 기존 /dashboard.
      router.replace(shouldUseMobile ? '/m/chat' : '/dashboard');
    }
  }, [isAuthenticated, router, shouldUseMobile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await setup(password, confirmPassword);
  };

  const passwordMatch = password === confirmPassword;
  const isValid = password.length >= 4 && passwordMatch;
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      background: 'var(--bg-surface)',
      color: 'var(--text-primary)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      fontSize: '13px',
      padding: '0 16px',
      boxSizing: 'border-box',
    }}>
      {/* bg-pattern */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse at 30% 40%, rgba(124,92,252,0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(52,211,153,0.1) 0%, transparent 50%)',
      }} />
      {/* bg-grid */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0,
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Setup Card */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: 420, background: 'var(--bg-card)',
        borderRadius: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        padding: '48px 40px',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'var(--text-primary)', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            boxShadow: '0 8px 20px rgba(16,20,26,0.25)',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>초기 설정</div>
          <div style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 6, lineHeight: 1.5 }}>
            YJ Manager에 오신 것을 환영합니다.<br />관리자 비밀번호를 설정해주세요.
          </div>
        </div>

        {/* Steps */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          marginBottom: 28,
        }}>
          {/* Step 1 - done */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, color: '#34D399' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              background: '#34D399', color: 'white',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            서버 확인
          </div>
          {/* Line done */}
          <div style={{ width: 32, height: 2, background: '#34D399', borderRadius: 1 }} />
          {/* Step 2 - active */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, color: 'var(--text-primary)' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              background: '#7C5CFC', color: 'white',
            }}>
              2
            </div>
            비밀번호
          </div>
          {/* Line pending */}
          <div style={{ width: 32, height: 2, background: 'var(--border-light)', borderRadius: 1 }} />
          {/* Step 3 - pending */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
              background: 'var(--bg-content-card)', color: 'var(--text-tertiary)',
            }}>
              3
            </div>
            완료
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Password field */}
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
              비밀번호
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type="password"
                placeholder="8자 이상 입력"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  border: '1.5px solid var(--border-light)',
                  borderRadius: 12,
                  fontSize: 16, // BUG-028: iOS 자동 확대 방지(16px 미만이면 포커스 시 확대)
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: 'var(--bg-surface)',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#7C5CFC';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,92,252,0.1)';
                  e.currentTarget.style.background = 'white';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-light)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.background = 'var(--bg-surface)';
                }}
              />
            </div>
            {/* Strength Bar */}
            {password && (
              <div style={{ marginTop: 8 }}>
                <div style={{
                  height: 4, background: 'var(--bg-content-card)', borderRadius: 2,
                  overflow: 'hidden', display: 'flex', gap: 3,
                }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} style={{
                      flex: 1, height: '100%', borderRadius: 2,
                      transition: 'background 0.3s',
                      background: getSegmentColor(i, strength.level),
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10 }}>
                  <span style={{ color: getStrengthTextColor(strength.level), fontWeight: 500 }}>{strength.text}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{strength.hint}</span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password field */}
          <div style={{ textAlign: 'left' }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>
              비밀번호 확인
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </span>
              <input
                type="password"
                placeholder="비밀번호 재입력"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  border: `1.5px solid ${confirmPassword && passwordMatch ? '#34D399' : 'var(--border-light)'}`,
                  borderRadius: 12,
                  fontSize: 16, // BUG-028: iOS 자동 확대 방지(16px 미만이면 포커스 시 확대)
                  fontFamily: 'inherit',
                  outline: 'none',
                  background: 'var(--bg-surface)',
                  boxSizing: 'border-box',
                  boxShadow: confirmPassword && passwordMatch ? '0 0 0 3px rgba(52,211,153,0.1)' : 'none',
                }}
                onFocus={(e) => {
                  if (!(confirmPassword && passwordMatch)) {
                    e.currentTarget.style.borderColor = '#7C5CFC';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(124,92,252,0.1)';
                  }
                  e.currentTarget.style.background = 'white';
                }}
                onBlur={(e) => {
                  if (confirmPassword && passwordMatch) {
                    e.currentTarget.style.borderColor = '#34D399';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(52,211,153,0.1)';
                  } else {
                    e.currentTarget.style.borderColor = 'var(--border-light)';
                    e.currentTarget.style.boxShadow = 'none';
                  }
                  e.currentTarget.style.background = 'var(--bg-surface)';
                }}
              />
            </div>
            {/* Match indicator */}
            {confirmPassword && passwordMatch && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginTop: 4, color: '#34D399' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                비밀번호가 일치합니다
              </div>
            )}
            {confirmPassword && !passwordMatch && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginTop: 4, color: 'var(--status-error)' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                비밀번호가 일치하지 않습니다
              </div>
            )}
          </div>

          {/* Error message */}
          {error && (
            <p style={{ fontSize: 12, color: 'var(--status-error)' }}>{error}</p>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading || !isValid}
            style={{
              width: '100%',
              padding: 13,
              background: isLoading || !isValid ? '#B8A5FD' : '#7C5CFC',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: isLoading || !isValid ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              marginTop: 8,
              boxShadow: '0 4px 12px rgba(124,92,252,0.25)',
              opacity: isLoading || !isValid ? 0.7 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLoading && isValid) {
                e.currentTarget.style.background = '#6D4FE0';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && isValid) {
                e.currentTarget.style.background = '#7C5CFC';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            {isLoading ? '설정 중...' : '설정 완료'}
          </button>
        </form>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
          이 비밀번호는 서버에 안전하게 해시되어 저장됩니다.<br />
          분실 시 서버 CLI에서 재설정할 수 있습니다.
        </div>
      </div>
    </div>
  );
}
