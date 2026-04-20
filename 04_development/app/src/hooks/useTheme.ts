'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'theme';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(resolved: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', resolved);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('light');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  // Initialize from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial = stored || 'light';
    setThemeState(initial);

    const res = initial === 'system' ? getSystemTheme() : initial;
    setResolved(res);
    applyTheme(res);
  }, []);

  // Listen for system theme changes when mode is 'system'
  useEffect(() => {
    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const res = e.matches ? 'dark' : 'light';
      setResolved(res);
      applyTheme(res);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);

    const res = next === 'system' ? getSystemTheme() : next;
    setResolved(res);
    applyTheme(res);
  }, []);

  return { theme, resolved, setTheme };
}
