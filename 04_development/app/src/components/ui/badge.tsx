import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-[var(--radius-sm)] px-2 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-[var(--primary-100)] text-[var(--primary-700)]',
        active: 'bg-[var(--status-active-bg)] text-[var(--status-active-text)]',
        pending: 'bg-[var(--status-pending-bg)] text-[var(--status-pending-text)]',
        error: 'bg-[var(--status-error-bg)] text-[var(--status-error-text)]',
        complete: 'bg-[var(--status-complete-bg)] text-[var(--status-complete-text)]',
        idle: 'bg-[var(--status-idle-bg)] text-[var(--status-idle-text)]',
        stopped: 'bg-[var(--status-stopped-bg)] text-[var(--status-stopped-text)]',
        outline: 'border border-current bg-transparent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export type BadgeProps = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
