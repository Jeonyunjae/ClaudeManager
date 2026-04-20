'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * /workspace is deprecated. Redirect to /dashboard.
 */
export default function WorkspaceRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);

  return null;
}
