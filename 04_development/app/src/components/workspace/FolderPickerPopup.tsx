'use client';

import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '@/lib/api';

const T = {
  textPrimary: '#10141A',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  borderLight: '#E5E7EB',
  accentPurple: '#7C5CFC',
};

type BrowseResult = {
  current: string;
  parent: string | null;
  folders: Array<{ name: string; path: string }>;
};

interface FolderPickerPopupProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function FolderPickerPopup({ onSelect, onClose }: FolderPickerPopupProps) {
  const [data, setData] = useState<BrowseResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [pathInput, setPathInput] = useState('');

  const browse = useCallback(async (dirPath?: string) => {
    setLoading(true);
    try {
      const query = dirPath ? `?path=${encodeURIComponent(dirPath)}` : '';
      const res = await apiClient.get<BrowseResult>(`/api/fs/browse${query}`);
      setData(res.data);
      setPathInput(res.data.current);
    } catch {
      // stay on current
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    browse();
  }, [browse]);

  const handleGo = () => {
    if (pathInput.trim()) browse(pathInput.trim());
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.4)', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'white', borderRadius: '16px', width: '520px',
        maxHeight: '70vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: `1px solid ${T.borderLight}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: T.textPrimary }}>
            폴더 선택
          </span>
          <button onClick={onClose} style={{
            width: '28px', height: '28px', borderRadius: '6px', border: 'none',
            background: 'transparent', cursor: 'pointer', fontSize: '16px',
            color: T.textTertiary, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            ×
          </button>
        </div>

        {/* Path Input */}
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${T.borderLight}`, display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleGo(); }}
            style={{
              flex: 1, padding: '7px 12px', borderRadius: '8px',
              border: `1px solid ${T.borderLight}`, fontSize: '12px',
              fontFamily: "'JetBrains Mono', monospace", outline: 'none',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = T.accentPurple; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = T.borderLight; }}
          />
          <button onClick={handleGo} style={{
            padding: '7px 14px', borderRadius: '8px', border: `1px solid ${T.borderLight}`,
            background: 'white', fontSize: '12px', cursor: 'pointer',
            color: T.textSecondary, fontWeight: 500,
          }}>
            이동
          </button>
        </div>

        {/* Folder List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {loading ? (
            <div style={{ padding: '40px 0', textAlign: 'center', fontSize: '12px', color: T.textTertiary }}>
              로딩 중...
            </div>
          ) : data ? (
            <>
              {/* Parent directory */}
              {data.parent && (
                <button
                  onClick={() => browse(data.parent!)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', width: '100%', border: 'none',
                    background: 'transparent', cursor: 'pointer', borderRadius: '8px',
                    fontSize: '12px', color: T.textSecondary, fontWeight: 500,
                    textAlign: 'left', fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                  ..
                </button>
              )}
              {data.folders.length === 0 && (
                <div style={{ padding: '20px 0', textAlign: 'center', fontSize: '11px', color: T.textTertiary }}>
                  하위 폴더 없음
                </div>
              )}
              {data.folders.map((folder) => (
                <button
                  key={folder.path}
                  onClick={() => browse(folder.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', width: '100%', border: 'none',
                    background: 'transparent', cursor: 'pointer', borderRadius: '8px',
                    fontSize: '12px', color: T.textPrimary,
                    textAlign: 'left', fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F3F4F6'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#FCD34D" stroke="#F59E0B" strokeWidth="1.5">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  {folder.name}
                </button>
              ))}
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: `1px solid ${T.borderLight}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{
            fontSize: '11px', color: T.textTertiary,
            fontFamily: "'JetBrains Mono', monospace",
            maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {data?.current || ''}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{
              padding: '8px 16px', borderRadius: '8px',
              border: `1px solid ${T.borderLight}`, background: 'white',
              fontSize: '12px', cursor: 'pointer', color: T.textSecondary,
            }}>
              취소
            </button>
            <button
              onClick={() => { if (data?.current) onSelect(data.current); }}
              style={{
                padding: '8px 20px', borderRadius: '8px', border: 'none',
                background: T.accentPurple, color: 'white', fontSize: '12px',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              이 폴더 선택
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
