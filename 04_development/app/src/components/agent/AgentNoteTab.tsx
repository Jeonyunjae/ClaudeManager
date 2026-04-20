'use client';

import React, { useEffect, useState } from 'react';
import { useAgentDetailStore } from '@/stores/agentDetailStore';
import { formatDateTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function AgentNoteTab() {
  const { selectedAgent, notes, fetchNotes } = useAgentDetailStore();
  const [selectedNote, setSelectedNote] = useState<string | null>(null);

  useEffect(() => {
    if (selectedAgent) {
      fetchNotes(selectedAgent.id);
    }
  }, [selectedAgent, fetchNotes]);

  if (notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-[var(--text-tertiary)]">
        노트가 없습니다.
      </div>
    );
  }

  const activeNote = selectedNote ? notes.find((n) => n.file === selectedNote) : notes[0];

  return (
    <div className="flex gap-3 h-full">
      {/* File list */}
      <div className="w-48 shrink-0 border-r border-[var(--primary-50)] pr-3 space-y-1 overflow-y-auto">
        {notes.map((note) => (
          <button
            key={note.file}
            onClick={() => setSelectedNote(note.file)}
            className={cn(
              'w-full text-left px-2 py-1.5 rounded-[var(--radius-sm)] text-xs transition-colors',
              (selectedNote || notes[0]?.file) === note.file
                ? 'bg-[var(--primary-100)] text-[var(--primary-700)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--primary-50)]'
            )}
          >
            <p className="font-medium truncate">{note.file}</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">{formatDateTime(note.updatedAt)}</p>
          </button>
        ))}
      </div>

      {/* Note content */}
      <div className="flex-1 overflow-y-auto">
        {activeNote ? (
          <div className="prose prose-sm max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-[var(--text-primary)] font-mono bg-[var(--bg-surface)] p-3 rounded-[var(--radius-md)]">
              {activeNote.content}
            </pre>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-tertiary)]">노트를 선택하세요.</p>
        )}
      </div>
    </div>
  );
}
