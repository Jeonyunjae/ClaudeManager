'use client';

import React from 'react';

/* ── Design Constants ── */
const CARD_HEIGHT = 96;
const CARD_RADIUS = 14;
const CARD_PADDING = 14;
const ICON_SIZE = 36;
const FONT = {
  title: 13,
  subtitle: 11,
  meta: 10,
};

/* ── StatusDot ── */
export function StatusDot({ status, size = 8 }: { status: string; size?: number }) {
  const bg: Record<string, string> = {
    active: 'var(--status-active, #3B82F6)',
    idle: 'var(--status-idle, #9CA3AF)',
    pending: 'var(--status-pending, #F59E0B)',
    error: 'var(--status-error, #EF4444)',
    complete: 'var(--status-complete, #10B981)',
    stopped: 'var(--text-tertiary, #9CA3AF)',
  };

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg[status] || bg.idle,
        flexShrink: 0,
      }}
    />
  );
}

/* ── StatusBadge ── */
function StatusBadge({
  status,
  count,
  label,
  dark,
}: {
  status: string;
  count: number;
  label: string;
  dark?: boolean;
}) {
  if (count <= 0) return null;

  const colorMap: Record<string, string> = {
    pending: 'var(--status-pending, #F59E0B)',
    active: 'var(--status-active, #3B82F6)',
    complete: 'var(--status-complete, #10B981)',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: FONT.meta,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 8,
        background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
        color: colorMap[status] || 'var(--text-tertiary, #9CA3AF)',
      }}
    >
      <StatusDot status={status} size={6} />
      {count} {label}
    </span>
  );
}

/* ── CardShell — shared wrapper ── */
function CardShell({
  dark,
  selected,
  accentColor,
  onClick,
  children,
}: {
  dark?: boolean;
  selected?: boolean;
  accentColor: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const style: React.CSSProperties = {
    background: dark ? 'var(--bg-dark-card, #10141A)' : 'var(--bg-card, #FFFFFF)',
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    height: CARD_HEIGHT,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: selected
      ? '0 0 0 3px rgba(124,92,252,0.15), 0 4px 12px rgba(0,0,0,0.08)'
      : '0 1px 3px rgba(0,0,0,0.04)',
    border: selected ? '2px solid var(--accent-purple, #7C5CFC)' : '2px solid transparent',
  };

  if (!selected && !dark) {
    style.borderLeft = `3px solid ${accentColor}`;
  }

  return (
    <div style={style} onClick={onClick}>
      {children}
      <div style={{ height: 3, borderRadius: 2, background: accentColor }} />
    </div>
  );
}

/* ── CardIcon ── */
function CardIcon({
  color,
  label,
  round,
  children,
}: {
  color: string;
  label?: string;
  round?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        borderRadius: round ? '50%' : 10,
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 13,
        color: 'white',
        flexShrink: 0,
      }}
    >
      {children || label}
    </div>
  );
}

/* ── CardHeader — icon + title + subtitle + status dot ── */
function CardHeader({
  icon,
  title,
  subtitle,
  status,
  dark,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  status: string;
  dark?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {icon}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: FONT.title,
            fontWeight: 600,
            color: dark ? 'white' : 'var(--text-primary, #10141A)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: FONT.subtitle,
            color: dark ? '#9CA3AF' : 'var(--text-secondary, #6B7280)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: 1,
          }}
        >
          {subtitle}
        </div>
      </div>
      <StatusDot status={status} size={8} />
    </div>
  );
}

/* ════════════════════════════════════════
   Public Card Components
   ════════════════════════════════════════ */

/** Main agent card (dark theme) */
export function MainAgentCard({
  status,
  model,
  pendingCount,
  onClick,
}: {
  status: string;
  model?: string;
  pendingCount?: number;
  onClick?: () => void;
}) {
  return (
    <CardShell dark accentColor="var(--accent-purple, #7C5CFC)" onClick={onClick}>
      <div>
        <CardHeader
          dark
          icon={
            <CardIcon color="var(--accent-purple, #7C5CFC)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </CardIcon>
          }
          title="Main"
          subtitle="Project Orchestrator"
          status={status}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: FONT.meta, color: '#9CA3AF' }}>
          <span>{model || 'claude-opus-4'}</span>
          <StatusBadge dark status="pending" count={pendingCount || 0} label="pending" />
        </div>
      </div>
    </CardShell>
  );
}

/** Part card (skill group, not an agent) */
export function PartCard({
  name,
  description,
  skillName,
  status,
  color,
  projectCount,
  activeCount,
  pendingCount,
  isSelected,
  onClick,
}: {
  name: string;
  description?: string;
  skillName?: string;
  status: string;
  color: string;
  projectCount: number;
  activeCount: number;
  pendingCount: number;
  isSelected?: boolean;
  onClick?: () => void;
}) {
  return (
    <CardShell accentColor={color} selected={isSelected} onClick={onClick}>
      <div>
        <CardHeader
          icon={<CardIcon color={color} label={name.slice(0, 3)} />}
          title={name}
          subtitle={description || skillName || ''}
          status={status}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: FONT.meta, color: 'var(--text-tertiary, #9CA3AF)' }}>
          <span>{projectCount} project{projectCount !== 1 ? 's' : ''}</span>
          <StatusBadge status="active" count={activeCount} label="active" />
          <StatusBadge status="pending" count={pendingCount} label="pending" />
        </div>
      </div>
    </CardShell>
  );
}

/** Sub/Instance agent card */
export function AgentCard({
  name,
  subtitle,
  status,
  color,
  isSelected,
  isInstance,
  modelName,
  activeCount,
  pendingCount,
  completeCount,
  onClick,
}: {
  name: string;
  subtitle: string;
  status: string;
  color: string;
  isSelected?: boolean;
  isInstance?: boolean;
  modelName?: string;
  activeCount?: number;
  pendingCount?: number;
  completeCount?: number;
  onClick?: () => void;
}) {
  return (
    <CardShell accentColor={color} selected={isSelected} onClick={onClick}>
      <div>
        <CardHeader
          icon={<CardIcon color={color} label={name.slice(0, 3)} round={isInstance} />}
          title={name}
          subtitle={subtitle}
          status={status}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: FONT.meta, color: 'var(--text-tertiary, #9CA3AF)' }}>
          {isInstance ? (
            <span>{modelName || 'claude-sonnet'}</span>
          ) : (
            <>
              <StatusBadge status="pending" count={pendingCount || 0} label="pending" />
              <StatusBadge status="active" count={activeCount || 0} label="active" />
              <StatusBadge status="complete" count={completeCount || 0} label="done" />
            </>
          )}
        </div>
      </div>
    </CardShell>
  );
}

/** Task card (lighter, for Main column task list) */
export function TaskCard({
  name,
  meta,
  status,
  hasApproval,
  onClick,
}: {
  name: string;
  meta: string;
  status: string;
  hasApproval?: boolean;
  onClick?: () => void;
}) {
  const borderColor: Record<string, string> = {
    pending: 'var(--status-pending, #F59E0B)',
    active: 'var(--status-active, #3B82F6)',
    complete: 'var(--status-complete, #10B981)',
    error: 'var(--status-error, #EF4444)',
  };

  return (
    <div
      style={{
        background: 'var(--bg-card, #FFFFFF)',
        borderRadius: CARD_RADIUS,
        padding: CARD_PADDING,
        cursor: 'pointer',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        border: '2px solid transparent',
        borderLeft: `3px solid ${borderColor[status] || 'transparent'}`,
        opacity: status === 'complete' ? 0.7 : 1,
        transition: 'all 0.15s',
      }}
      onClick={onClick}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <StatusDot status={status} size={8} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: FONT.title, fontWeight: 600, color: 'var(--text-primary, #10141A)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </div>
          <div style={{ fontSize: FONT.subtitle, color: 'var(--text-tertiary, #9CA3AF)', marginTop: 1 }}>{meta}</div>
        </div>
        {hasApproval && (
          <span style={{ fontSize: 9, fontWeight: 600, padding: '2px 6px', borderRadius: 6, background: 'var(--status-approval-bg, #FEF3C7)', color: 'var(--status-approval-text, #92400E)', flexShrink: 0 }}>
            Approval
          </span>
        )}
      </div>
    </div>
  );
}

/** Column header */
export function ColumnHeader({
  title,
  count,
  showAdd,
  onAdd,
}: {
  title: string;
  count: number | string;
  showAdd?: boolean;
  onAdd?: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 4px', marginBottom: 4, height: 36 }}>
      <div style={{ fontSize: FONT.title, fontWeight: 700, color: 'var(--text-primary, #10141A)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {title}
        <span style={{ fontSize: FONT.meta, fontWeight: 600, background: 'rgba(0,0,0,0.06)', padding: '2px 8px', borderRadius: 10, color: 'var(--text-tertiary, #9CA3AF)' }}>
          {count}
        </span>
      </div>
      {showAdd && (
        <button
          style={{ width: 28, height: 28, borderRadius: 8, border: '1.5px dashed var(--border-column, #D1D5DB)', background: 'transparent', color: 'var(--text-tertiary, #9CA3AF)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
          title={`New ${title}`}
          onClick={onAdd}
        >
          +
        </button>
      )}
    </div>
  );
}

/** Column empty state */
export function ColumnEmpty({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '48px 16px', color: 'var(--text-tertiary, #9CA3AF)', textAlign: 'center' }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary, #9CA3AF)' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
          <polyline points="10 17 15 12 10 7" />
          <line x1="15" y1="12" x2="3" y2="12" />
        </svg>
      </div>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-tertiary, #9CA3AF)' }} dangerouslySetInnerHTML={{ __html: text }} />
    </div>
  );
}
