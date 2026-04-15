'use client';

import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { DollarSign, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

const resourceLinks = [
  {
    href: '/dashboard/cost',
    icon: DollarSign,
    title: '비용 대시보드',
    description: '모델별 토큰 사용량, API 비용 추이',
  },
  {
    href: '/resources/approvals',
    icon: CheckCircle,
    title: '승인 이력',
    description: '승인/반려/수정 지시 전체 이력',
  },
  {
    href: '/resources/errors',
    icon: AlertTriangle,
    title: '오류 로그',
    description: '에이전트 오류 및 재시도 로그',
  },
  {
    href: '/resources/audit',
    icon: FileText,
    title: '감사 로그',
    description: '시스템 전체 행동 기록',
  },
];

export default function ResourcesPage() {
  return (
    <div className="p-[var(--space-6)] space-y-6">
      <h1 className="text-[var(--text-h1)] font-bold">리소스 관리</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {resourceLinks.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href}>
              <Card className="hover:shadow-[var(--shadow-md)] transition-shadow cursor-pointer h-full">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-[var(--radius-md)] bg-[var(--primary-50)]">
                      <Icon className="h-5 w-5 text-[var(--primary-500)]" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{item.title}</CardTitle>
                      <CardDescription>{item.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
