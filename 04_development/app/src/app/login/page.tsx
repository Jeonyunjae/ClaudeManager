'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading, error } = useAuthStore();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      // /workspace는 폐기된 경로로 /dashboard 로 재리다이렉트만 한다.
      // 한 단계 건너뛰어 곧바로 대시보드로 보낸다.
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(password);
  };

  return (
    <div
      style={{
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        background: 'var(--bg-surface)',
        color: 'var(--text-primary)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Background pattern */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          background:
            'radial-gradient(ellipse at 20% 50%, rgba(124,92,252,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(59,130,246,0.1) 0%, transparent 50%), radial-gradient(ellipse at 60% 80%, rgba(52,211,153,0.08) 0%, transparent 50%)',
        }}
      />
      {/* Background grid */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Floating badges */}
      <FloatingBadge style={{ top: '15%', left: '8%', transform: 'rotate(-5deg)' }}>
        Main · Active
      </FloatingBadge>
      <FloatingBadge style={{ top: '25%', right: '10%', transform: 'rotate(3deg)' }}>
        개발팀 · 60%
      </FloatingBadge>
      <FloatingBadge style={{ bottom: '20%', left: '12%', transform: 'rotate(2deg)' }}>
        claude-opus-4
      </FloatingBadge>
      <FloatingBadge style={{ bottom: '30%', right: '8%', transform: 'rotate(-3deg)' }}>
        Agent Journeys
      </FloatingBadge>

      {/* Login Card */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: 400,
          background: 'var(--bg-card)',
          borderRadius: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
          padding: '48px 40px',
          textAlign: 'center',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              background: 'var(--text-primary)',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 800,
              boxShadow: '0 4px 12px rgba(16,20,26,0.3)',
            }}
          >
            YJ
          </div>
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--text-primary)',
              letterSpacing: '-0.02em',
            }}
          >
            YJ Manager
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--text-tertiary)',
            marginBottom: 36,
          }}
        >
          AI 에이전트 오케스트레이션 플랫폼
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <label
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--text-secondary)',
                marginBottom: 6,
                display: 'block',
              }}
            >
              비밀번호
            </label>
            <div style={{ position: 'relative' }}>
              {/* Lock icon */}
              <span
                style={{
                  position: 'absolute',
                  left: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                autoFocus
                style={{
                  width: '100%',
                  padding: '12px 42px 12px 42px',
                  border: `1.5px solid ${error ? 'var(--status-error)' : isFocused ? '#7C5CFC' : 'var(--border-light)'}`,
                  borderRadius: 12,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'all 0.15s',
                  background: isFocused ? 'var(--bg-card)' : 'var(--bg-surface)',
                  boxShadow: error
                    ? '0 0 0 3px rgba(239,68,68,0.1)'
                    : isFocused
                      ? '0 0 0 3px rgba(124,92,252,0.1)'
                      : 'none',
                }}
              />
              {/* Toggle visibility button */}
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'var(--status-error-bg)',
                color: 'var(--status-error-text)',
                fontSize: 12,
                fontWeight: 500,
                textAlign: 'left',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ flexShrink: 0 }}
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}

          {/* Login button */}
          <button
            type="submit"
            disabled={isLoading || !password}
            style={{
              width: '100%',
              padding: 13,
              background: isLoading || !password ? '#A78BFA' : '#7C5CFC',
              color: 'white',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: isLoading || !password ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              marginTop: 4,
              boxShadow: '0 4px 12px rgba(124,92,252,0.25)',
              opacity: isLoading || !password ? 0.7 : 1,
            }}
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        {/* Footer */}
        <div
          style={{
            marginTop: 24,
            fontSize: 11,
            color: 'var(--text-tertiary)',
          }}
        >
          개인 서버 전용 · 단일 사용자 인증
        </div>
      </div>
    </div>
  );
}

function FloatingBadge({
  children,
  style,
}: {
  children: React.ReactNode;
  style: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 0,
        padding: '6px 14px',
        borderRadius: 10,
        fontSize: 11,
        fontWeight: 500,
        background: 'rgba(255,255,255,0.06)',
        color: 'rgba(255,255,255,0.3)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.06)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}
