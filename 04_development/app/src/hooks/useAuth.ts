'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export function useAuth(redirectTo = '/login'): { isAuthenticated: boolean; isLoading: boolean } {
  const router = useRouter();
  const { isAuthenticated, isLoading, hasCheckedAuth, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // hasCheckedAuth 이전에는 localStorage를 아직 안 읽은 상태라
    // isAuthenticated=false가 "미인증"을 뜻하지 않는다. 여기서 리다이렉트하면
    // 새로고침·URL 직접 진입 때마다 /login 으로 튕긴다.
    if (hasCheckedAuth && !isLoading && !isAuthenticated) {
      router.push(redirectTo);
    }
  }, [isAuthenticated, isLoading, hasCheckedAuth, router, redirectTo]);

  // 인증 확인 전에는 로딩으로 취급해 하위 화면이 섣불리 렌더되지 않게 한다.
  return { isAuthenticated, isLoading: isLoading || !hasCheckedAuth };
}
