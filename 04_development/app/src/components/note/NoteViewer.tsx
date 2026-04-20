'use client';

import React, { useState, useEffect } from 'react';
import { FolderTree, type TreeNode } from './FolderTree';
import { NoteRenderer } from './NoteRenderer';
import { ExternalLink, ArrowLeft } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface NoteViewerProps {
  agentId: string;
  agentName: string;
  onOpenInNewTab?: (noteId: string) => void;
}

export function NoteViewer({ agentId, agentName, onOpenInNewTab }: NoteViewerProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadNoteTree();
  }, [agentId]);

  async function loadNoteTree() {
    try {
      const res = await apiClient.get<{ files: TreeNode[] }>(`/api/agents/${agentId}/notes`);
      const data = (res as any)?.data ?? res;
      setTree(data?.files || []);
    } catch {
      setTree([]);
    }
  }

  async function loadNote(path: string) {
    setIsLoading(true);
    setSelectedPath(path);
    try {
      const res = await apiClient.get<{ content: string }>(`/api/agents/${agentId}/notes?file=${encodeURIComponent(path)}`);
      const data = (res as any)?.data ?? res;
      setContent(data?.content || '');
    } catch {
      setContent('Failed to load note.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex h-full">
      {/* Folder tree sidebar */}
      <div className="w-[200px] border-r border-[var(--primary-50)] overflow-y-auto bg-[var(--bg-surface)]">
        <div className="px-3 py-2 border-b border-[var(--primary-50)]">
          <p className="text-xs font-semibold text-[var(--text-primary)]">{agentName}</p>
          <p className="text-[10px] text-[var(--text-tertiary)]">Notes</p>
        </div>
        <FolderTree
          nodes={tree}
          selectedPath={selectedPath || undefined}
          onSelect={loadNote}
        />
      </div>

      {/* Note content */}
      <div className="flex-1 overflow-y-auto">
        {!selectedPath ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">
            Select a note from the tree to view.
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">
            Loading...
          </div>
        ) : (
          <div className="max-w-[900px] mx-auto p-6">
            {/* Note header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
                <span>{agentName}</span>
                <span>/</span>
                <span className="text-[var(--text-secondary)]">{selectedPath}</span>
              </div>
              {onOpenInNewTab && (
                <button
                  onClick={() => onOpenInNewTab(selectedPath)}
                  className="flex items-center gap-1 text-xs text-[var(--primary-500)] hover:underline"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in new tab
                </button>
              )}
            </div>

            <NoteRenderer content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
