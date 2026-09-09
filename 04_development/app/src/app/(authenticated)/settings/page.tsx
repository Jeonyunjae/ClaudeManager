'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { apiClient } from '@/lib/api';
import { usePartStore } from '@/stores/partStore';
import { useTheme, Theme } from '@/hooks/useTheme';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface PartPolicy {
  retryCount: number;
  retryStrategy: string;
  retryIntervalBase: number;
  approvalStages: string[];
  defaultModel: string | null;
  sensitivityLevel: string;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */
const TABS = ['Global Settings', 'Part Policies', 'CLI Status', 'My Profile'] as const;
type TabLabel = typeof TABS[number];

const colors = {
  bgCard: 'var(--bg-card)',
  bgContentCard: 'var(--bg-content-card)',
  textPrimary: 'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textTertiary: 'var(--text-tertiary)',
  borderLight: 'var(--border-light)',
  accentPurple: 'var(--accent-purple)',
  accentPurpleHover: 'var(--primary-600)',
  statusError: 'var(--status-error)',
  shadowCard: 'var(--shadow-card)',
};

/* ------------------------------------------------------------------ */
/*  Toggle Component                                                   */
/* ------------------------------------------------------------------ */
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: on ? colors.accentPurple : 'var(--border-light)',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'white',
          top: 3,
          left: 3,
          transition: 'transform 0.2s',
          transform: on ? 'translateX(20px)' : 'translateX(0)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */
export default function SettingsPage() {
  const { settings, fetchSettings, updateSettings } = useSettingsStore();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<TabLabel>('Global Settings');
  const [isSaving, setIsSaving] = useState(false);

  /* Global Settings form */
  const [planBaseCost, setPlanBaseCost] = useState('$200.00');
  const [overageLimit, setOverageLimit] = useState('$2000.00');
  const [maxAgents, setMaxAgents] = useState(10);
  const [retryCount, setRetryCount] = useState(3);
  const [notifications, setNotifications] = useState(true);
  const [alertThreshold, setAlertThreshold] = useState('80%');
  const [defaultModel, setDefaultModel] = useState('claude-opus-4');
  const [skillsAccountUrl, setSkillsAccountUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubTokenMasked, setGithubTokenMasked] = useState<string | null>(null);

  /* CLI Status */
  const [cliStatus, setCliStatus] = useState<{
    installed: boolean;
    version: string | null;
    loggedIn: boolean;
    email: string | null;
    authMethod: string | null;
    subscriptionType: string | null;
    orgName: string | null;
  } | null>(null);
  const [cliLoading, setCliLoading] = useState(false);


  /* Part Policies */
  const { parts, selectedPartId, fetchParts, selectPart } = usePartStore();
  const [partPolicy, setPartPolicy] = useState<PartPolicy | null>(null);
  const [policySaving, setPolicySaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) {
      setPlanBaseCost(`$${(settings.planBaseCost ?? 200).toFixed(2)}`);
      setOverageLimit(`$${(settings.overageLimit ?? 2000).toFixed(2)}`);
      setMaxAgents(settings.maxConcurrentAgents);
      setRetryCount(settings.retryCount);
      setAlertThreshold(`${settings.alertThreshold}%`);
      setSkillsAccountUrl(settings.skillsAccountUrl ?? '');
    }
  }, [settings]);

  /* Load CLI status */
  const loadCliStatus = useCallback(async () => {
    setCliLoading(true);
    try {
      const res = await apiClient.get<typeof cliStatus>('/api/cli/status');
      setCliStatus(res.data);
    } catch {
      setCliStatus(null);
    } finally {
      setCliLoading(false);
    }
  }, []);

  /* 등록된 GitHub 토큰 표시용 */
  const loadGithubKey = useCallback(async () => {
    try {
      const res = await apiClient.get<{ provider: string; keyMasked: string }[]>('/api/apikeys');
      const gh = res.data.find((k) => k.provider === 'github');
      setGithubTokenMasked(gh?.keyMasked ?? null);
    } catch {
      setGithubTokenMasked(null);
    }
  }, []);

  useEffect(() => {
    loadCliStatus();
  }, [loadCliStatus]);

  useEffect(() => {
    loadGithubKey();
  }, [loadGithubKey]);

  /* Load parts */
  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  useEffect(() => {
    if (selectedPartId) {
      apiClient
        .get<PartPolicy>(`/api/parts/${selectedPartId}/policy`)
        .then((res) => setPartPolicy(res.data))
        .catch(() => setPartPolicy(null));
    }
  }, [selectedPartId]);

  /* Save global */
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const parsedPlanCost = parseFloat(planBaseCost.replace(/[^0-9.]/g, '')) || 200;
      const parsedOverageLimit = parseFloat(overageLimit.replace(/[^0-9.]/g, '')) || 2000;
      const parsedThreshold = parseInt(alertThreshold.replace('%', ''), 10) || 80;
      await updateSettings({
        planBaseCost: parsedPlanCost,
        overageLimit: parsedOverageLimit,
        maxConcurrentAgents: maxAgents,
        retryCount,
        alertThreshold: parsedThreshold,
        skillsAccountUrl: skillsAccountUrl.trim(),
      });
      if (githubToken.trim()) {
        await apiClient.post('/api/apikeys', { provider: 'github', key: githubToken.trim() });
        setGithubToken('');
        loadGithubKey();
      }
    } finally {
      setIsSaving(false);
    }
  };



  /* Save part policy */
  const handleSavePolicy = async () => {
    if (!selectedPartId || !partPolicy) return;
    setPolicySaving(true);
    try {
      await apiClient.put(`/api/parts/${selectedPartId}/policy`, partPolicy);
    } finally {
      setPolicySaving(false);
    }
  };

  /* ------- Shared Styles ------- */
  const sectionStyle: React.CSSProperties = {
    background: colors.bgCard,
    borderRadius: 14,
    boxShadow: colors.shadowCard,
    padding: 24,
    marginBottom: 16,
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 4,
  };

  const sectionDescStyle: React.CSSProperties = {
    fontSize: 12,
    color: colors.textTertiary,
    marginBottom: 20,
  };

  const settingRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 0',
    borderBottom: '1px solid var(--bg-content-card)',
  };

  const settingRowLastStyle: React.CSSProperties = {
    ...settingRowStyle,
    borderBottom: 'none',
  };

  const settingLabelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
  };

  const settingHintStyle: React.CSSProperties = {
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 2,
  };

  const settingInputStyle: React.CSSProperties = {
    width: 120,
    padding: '7px 12px',
    borderRadius: 8,
    border: `1px solid ${colors.borderLight}`,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    textAlign: 'right',
  };

  const settingSelectStyle: React.CSSProperties = {
    padding: '7px 12px',
    borderRadius: 8,
    border: `1px solid ${colors.borderLight}`,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    background: 'var(--bg-card)',
    cursor: 'pointer',
  };

  return (
    <div>
      {/* Content Card */}
      <div
        style={{
          background: colors.bgContentCard,
          borderRadius: 20,
          margin: '16px 20px',
          padding: '20px 12px',
          minHeight: 'calc(100vh - 56px - 68px)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '4px 12px', paddingBottom: 36 }}>
          {/* Sub Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 2,
              background: 'rgba(0,0,0,0.04)',
              borderRadius: 10,
              padding: 3,
              width: 'fit-content',
            }}
          >
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '7px 16px',
                  borderRadius: 8,
                  border: 'none',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === tab ? colors.textPrimary : colors.textSecondary,
                  boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                  fontFamily: 'inherit',
                  transition: 'all 0.15s',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1 }}>
            {/* ==================== Global Settings ==================== */}
            {activeTab === 'Global Settings' && (
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Global Settings</div>
                <div style={sectionDescStyle}>System-wide default configuration</div>

                {/* Plan Base Cost */}
                <div style={settingRowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={settingLabelStyle}>Plan Base Cost</div>
                    <div style={settingHintStyle}>Monthly subscription fee (Max 20x = $200)</div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 16 }}>
                    <input
                      style={settingInputStyle}
                      type="text"
                      value={planBaseCost}
                      onChange={(e) => setPlanBaseCost(e.target.value)}
                    />
                  </div>
                </div>

                {/* Overage Limit */}
                <div style={settingRowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={settingLabelStyle}>Overage Limit</div>
                    <div style={settingHintStyle}>Max additional cost beyond plan (alert when exceeded)</div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 16 }}>
                    <input
                      style={settingInputStyle}
                      type="text"
                      value={overageLimit}
                      onChange={(e) => setOverageLimit(e.target.value)}
                    />
                  </div>
                </div>

                {/* Max Agents */}
                <div style={settingRowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={settingLabelStyle}>Max Agents</div>
                    <div style={settingHintStyle}>Maximum concurrent agents</div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 16 }}>
                    <input
                      style={settingInputStyle}
                      type="number"
                      value={maxAgents}
                      onChange={(e) => setMaxAgents(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>

                {/* Default Retry Count */}
                <div style={settingRowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={settingLabelStyle}>Default Retry Count</div>
                    <div style={settingHintStyle}>Auto retry count on agent error</div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 16 }}>
                    <input
                      style={settingInputStyle}
                      type="number"
                      value={retryCount}
                      onChange={(e) => setRetryCount(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {/* Notifications */}
                <div style={settingRowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={settingLabelStyle}>Notifications</div>
                    <div style={settingHintStyle}>Browser push notifications</div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 16 }}>
                    <Toggle on={notifications} onToggle={() => setNotifications(!notifications)} />
                  </div>
                </div>

                {/* Cost Warning Threshold */}
                <div style={settingRowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={settingLabelStyle}>Cost Warning Threshold</div>
                    <div style={settingHintStyle}>Alert when reaching N% of monthly limit</div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 16 }}>
                    <select
                      style={settingSelectStyle}
                      value={alertThreshold}
                      onChange={(e) => setAlertThreshold(e.target.value)}
                    >
                      <option value="60%">60%</option>
                      <option value="80%">80%</option>
                      <option value="90%">90%</option>
                    </select>
                  </div>
                </div>

                {/* Default Model */}
                <div style={settingRowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={settingLabelStyle}>Default Model</div>
                    <div style={settingHintStyle}>Default model for new agents</div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 16 }}>
                    <select
                      style={settingSelectStyle}
                      value={defaultModel}
                      onChange={(e) => setDefaultModel(e.target.value)}
                    >
                      <option value="claude-opus-4">claude-opus-4</option>
                      <option value="claude-sonnet-4">claude-sonnet-4</option>
                      <option value="claude-haiku-4">claude-haiku-4</option>
                    </select>
                  </div>
                </div>

                {/* Skills Account */}
                <div style={settingRowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={settingLabelStyle}>Skills Account</div>
                    <div style={settingHintStyle}>
                      스킬을 보관하는 GitHub 계정 주소. 저장소 하나가 스킬 하나입니다.
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 16 }}>
                    <input
                      style={{ ...settingInputStyle, width: 380, textAlign: 'left' }}
                      value={skillsAccountUrl}
                      placeholder="https://github.com/Jeonyunjae-Skills"
                      onChange={(e) => setSkillsAccountUrl(e.target.value)}
                    />
                  </div>
                </div>

                {/* GitHub Token */}
                <div style={settingRowLastStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={settingLabelStyle}>GitHub Token</div>
                    <div style={settingHintStyle}>
                      {githubTokenMasked
                        ? `등록됨 (${githubTokenMasked}) — 새 값을 입력하면 교체됩니다`
                        : 'private 저장소를 읽으려면 필요합니다. 암호화해 저장됩니다.'}
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 16 }}>
                    <input
                      type="password"
                      style={{ ...settingInputStyle, width: 380, textAlign: 'left' }}
                      value={githubToken}
                      placeholder={githubTokenMasked ? '변경하려면 입력' : 'ghp_...'}
                      onChange={(e) => setGithubToken(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ==================== Part Policies ==================== */}
            {activeTab === 'Part Policies' && (
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>Part Policies</div>
                <div style={sectionDescStyle}>Configure retry and approval policies per part</div>

                {/* Part selector */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
                  {parts.map((part) => (
                    <button
                      key={part.id}
                      onClick={() => selectPart(part.id)}
                      style={{
                        padding: '7px 16px',
                        borderRadius: 8,
                        border: selectedPartId === part.id ? 'none' : `1px solid ${colors.borderLight}`,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        background: selectedPartId === part.id ? colors.accentPurple : 'var(--bg-card)',
                        color: selectedPartId === part.id ? 'white' : colors.textSecondary,
                        fontFamily: 'inherit',
                      }}
                    >
                      {part.name}
                    </button>
                  ))}
                </div>

                {partPolicy && (
                  <>
                    <div style={settingRowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={settingLabelStyle}>Retry Count</div>
                        <div style={settingHintStyle}>Number of retries on error</div>
                      </div>
                      <div style={{ flexShrink: 0, marginLeft: 16 }}>
                        <input
                          style={settingInputStyle}
                          type="number"
                          value={partPolicy.retryCount}
                          onChange={(e) =>
                            setPartPolicy({ ...partPolicy, retryCount: parseInt(e.target.value, 10) || 0 })
                          }
                        />
                      </div>
                    </div>

                    <div style={settingRowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={settingLabelStyle}>Retry Strategy</div>
                        <div style={settingHintStyle}>Exponential or fixed interval</div>
                      </div>
                      <div style={{ flexShrink: 0, marginLeft: 16 }}>
                        <select
                          style={settingSelectStyle}
                          value={partPolicy.retryStrategy}
                          onChange={(e) => setPartPolicy({ ...partPolicy, retryStrategy: e.target.value })}
                        >
                          <option value="exponential">Exponential</option>
                          <option value="fixed">Fixed</option>
                        </select>
                      </div>
                    </div>

                    <div style={settingRowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={settingLabelStyle}>Interval Base (s)</div>
                        <div style={settingHintStyle}>Base interval in seconds</div>
                      </div>
                      <div style={{ flexShrink: 0, marginLeft: 16 }}>
                        <input
                          style={settingInputStyle}
                          type="number"
                          value={partPolicy.retryIntervalBase}
                          onChange={(e) =>
                            setPartPolicy({ ...partPolicy, retryIntervalBase: parseInt(e.target.value, 10) || 10 })
                          }
                        />
                      </div>
                    </div>

                    <div style={settingRowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={settingLabelStyle}>Sensitivity Level</div>
                        <div style={settingHintStyle}>Determines approval requirements</div>
                      </div>
                      <div style={{ flexShrink: 0, marginLeft: 16 }}>
                        <select
                          style={settingSelectStyle}
                          value={partPolicy.sensitivityLevel}
                          onChange={(e) => setPartPolicy({ ...partPolicy, sensitivityLevel: e.target.value })}
                        >
                          <option value="normal">Normal</option>
                          <option value="sensitive">Sensitive</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                    </div>

                    <div style={settingRowLastStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={settingLabelStyle}>Default Model</div>
                        <div style={settingHintStyle}>Model used by agents in this part</div>
                      </div>
                      <div style={{ flexShrink: 0, marginLeft: 16 }}>
                        <input
                          style={{ ...settingInputStyle, width: 200, textAlign: 'left' }}
                          type="text"
                          value={partPolicy.defaultModel || ''}
                          onChange={(e) => setPartPolicy({ ...partPolicy, defaultModel: e.target.value || null })}
                          placeholder="e.g., claude-sonnet-4"
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 16, textAlign: 'right' }}>
                      <button
                        onClick={handleSavePolicy}
                        disabled={policySaving}
                        style={{
                          padding: '9px 24px',
                          borderRadius: 10,
                          border: 'none',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          background: colors.accentPurple,
                          color: 'white',
                          boxShadow: '0 2px 8px rgba(124,92,252,0.25)',
                          opacity: policySaving ? 0.6 : 1,
                        }}
                      >
                        {policySaving ? 'Saving...' : 'Save Policy'}
                      </button>
                    </div>
                  </>
                )}

                {!partPolicy && parts.length > 0 && selectedPartId && (
                  <div style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', padding: 20 }}>
                    Loading policy...
                  </div>
                )}
                {parts.length === 0 && (
                  <div style={{ fontSize: 12, color: colors.textTertiary, textAlign: 'center', padding: 20 }}>
                    No parts available.
                  </div>
                )}
              </div>
            )}

            {/* ==================== CLI Status ==================== */}
            {activeTab === 'CLI Status' && (
              <div style={sectionStyle}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={sectionTitleStyle}>Claude Code CLI</div>
                    <div style={sectionDescStyle}>CLI installation and authentication status</div>
                  </div>
                  <button
                    onClick={loadCliStatus}
                    disabled={cliLoading}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 8,
                      border: `1px solid ${colors.borderLight}`,
                      background: 'var(--bg-card)',
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      color: colors.textSecondary,
                      opacity: cliLoading ? 0.5 : 1,
                    }}
                  >
                    {cliLoading ? 'Checking...' : 'Refresh'}
                  </button>
                </div>

                {cliLoading && !cliStatus ? (
                  <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: colors.textTertiary }}>
                    Checking CLI status...
                  </div>
                ) : cliStatus ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 16 }}>
                    {/* Installation */}
                    <div style={settingRowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={settingLabelStyle}>Installation</div>
                        <div style={settingHintStyle}>Claude Code CLI binary</div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 10,
                        background: cliStatus.installed ? '#D1FAE5' : '#FEE2E2',
                        color: cliStatus.installed ? '#065F46' : '#991B1B',
                      }}>
                        {cliStatus.installed ? 'Installed' : 'Not Found'}
                      </span>
                    </div>

                    {/* Version */}
                    <div style={settingRowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={settingLabelStyle}>Version</div>
                        <div style={settingHintStyle}>Currently installed version</div>
                      </div>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 12, color: colors.textPrimary,
                        background: 'var(--bg-content-card)', padding: '3px 10px', borderRadius: 6,
                      }}>
                        {cliStatus.version ?? '--'}
                      </span>
                    </div>

                    {/* Auth Status */}
                    <div style={settingRowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={settingLabelStyle}>Authentication</div>
                        <div style={settingHintStyle}>Login status via claude auth</div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 10,
                        background: cliStatus.loggedIn ? '#D1FAE5' : '#FEE2E2',
                        color: cliStatus.loggedIn ? '#065F46' : '#991B1B',
                      }}>
                        {cliStatus.loggedIn ? 'Logged In' : 'Not Logged In'}
                      </span>
                    </div>

                    {/* Email */}
                    <div style={settingRowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={settingLabelStyle}>Account</div>
                        <div style={settingHintStyle}>Authenticated email address</div>
                      </div>
                      <span style={{ fontSize: 12, color: colors.textPrimary }}>
                        {cliStatus.email ?? '--'}
                      </span>
                    </div>

                    {/* Subscription */}
                    <div style={settingRowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={settingLabelStyle}>Subscription</div>
                        <div style={settingHintStyle}>Current plan type</div>
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10,
                        background: cliStatus.subscriptionType === 'max' ? '#EDE9FE' : 'var(--bg-content-card)',
                        color: cliStatus.subscriptionType === 'max' ? '#6D28D9' : colors.textSecondary,
                        textTransform: 'capitalize' as const,
                      }}>
                        {cliStatus.subscriptionType ?? '--'}
                      </span>
                    </div>

                    {/* Auth Method */}
                    <div style={settingRowStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={settingLabelStyle}>Auth Method</div>
                        <div style={settingHintStyle}>How the CLI is authenticated</div>
                      </div>
                      <span style={{ fontSize: 12, color: colors.textSecondary }}>
                        {cliStatus.authMethod ?? '--'}
                      </span>
                    </div>

                    {/* Organization */}
                    <div style={settingRowLastStyle}>
                      <div style={{ flex: 1 }}>
                        <div style={settingLabelStyle}>Organization</div>
                        <div style={settingHintStyle}>Associated organization</div>
                      </div>
                      <span style={{ fontSize: 12, color: colors.textSecondary, maxWidth: 240, textAlign: 'right' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {cliStatus.orgName ?? '--'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: colors.statusError }}>
                    Failed to check CLI status. Is the server running?
                  </div>
                )}
              </div>
            )}

            {/* ==================== My Profile ==================== */}
            {activeTab === 'My Profile' && (
              <div style={sectionStyle}>
                <div style={sectionTitleStyle}>My Profile</div>
                <div style={sectionDescStyle}>Account information and preferences</div>

                <div style={settingRowStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={settingLabelStyle}>Display Name</div>
                    <div style={settingHintStyle}>Your name shown in the interface</div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 16 }}>
                    <input
                      style={{ ...settingInputStyle, width: 180, textAlign: 'left' }}
                      type="text"
                      defaultValue="YJ"
                    />
                  </div>
                </div>

                <div style={settingRowLastStyle}>
                  <div style={{ flex: 1 }}>
                    <div style={settingLabelStyle}>Theme</div>
                    <div style={settingHintStyle}>Interface color scheme</div>
                  </div>
                  <div style={{ flexShrink: 0, marginLeft: 16 }}>
                    <select style={settingSelectStyle} value={theme} onChange={(e) => setTheme(e.target.value as Theme)}>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="system">System</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Bar */}
      <div
        style={{
          position: 'sticky',
          bottom: 56,
          background: colors.bgCard,
          borderTop: `1px solid ${colors.borderLight}`,
          padding: '12px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          margin: '0 20px',
          borderRadius: '0 0 20px 20px',
        }}
      >
        <button
          style={{
            padding: '9px 24px',
            borderRadius: 10,
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            background: 'var(--bg-content-card)',
            color: colors.textSecondary,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          style={{
            padding: '9px 24px',
            borderRadius: 10,
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            background: colors.accentPurple,
            color: 'white',
            boxShadow: '0 2px 8px rgba(124,92,252,0.25)',
            opacity: isSaving ? 0.6 : 1,
          }}
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </div>
  );
}
