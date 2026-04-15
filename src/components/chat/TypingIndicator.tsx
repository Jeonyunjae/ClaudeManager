import React from 'react';

export function TypingIndicator() {
  return (
    <div className="flex justify-start mb-3">
      <div className="flex gap-2">
        <div className="shrink-0 w-8 h-8 rounded-full bg-[var(--primary-100)] flex items-center justify-center">
          <span className="text-xs font-bold text-[var(--primary-600)]">M</span>
        </div>
        <div className="bg-white border border-[var(--primary-50)] px-4 py-3 rounded-[var(--radius-2xl)] rounded-bl-[var(--radius-sm)] shadow-[var(--shadow-sm)]">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-[var(--primary-300)] animate-bounce [animation-delay:0ms]" />
            <span className="w-2 h-2 rounded-full bg-[var(--primary-300)] animate-bounce [animation-delay:150ms]" />
            <span className="w-2 h-2 rounded-full bg-[var(--primary-300)] animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    </div>
  );
}
