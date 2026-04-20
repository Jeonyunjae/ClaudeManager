'use client';

import React from 'react';
import { WorkspaceLayout } from '@/components/workspace/WorkspaceLayout';
import { RecoveryOverlay } from '@/components/workspace/RecoveryOverlay';
import { SuccessToast } from '@/components/workspace/SuccessToast';

/**
 * SCR-DASH-001: Prototype-matched 4-column dashboard
 * Columns: Main (Tasks) | Part | Sub | Instance
 * Bottom: Activity Log + Task Status Donut
 */
export default function DashboardPage() {
  return (
    <>
      <WorkspaceLayout />
      <RecoveryOverlay />
      <SuccessToast />
    </>
  );
}
