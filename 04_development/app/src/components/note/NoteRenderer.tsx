'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface NoteRendererProps {
  content: string;
  className?: string;
}

export function NoteRenderer({ content, className }: NoteRendererProps) {
  return (
    <div className={`prose prose-sm max-w-none ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-[var(--text-primary)] mb-4 pb-2 border-b border-[var(--primary-50)]">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mt-6 mb-3">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-semibold text-[var(--text-primary)] mt-4 mb-2">{children}</h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-sm font-semibold text-[var(--text-primary)] mt-3 mb-1">{children}</h4>
          ),
          p: ({ children }) => (
            <p className="text-sm text-[var(--text-secondary)] mb-3 leading-relaxed">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-sm text-[var(--text-secondary)] mb-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-sm text-[var(--text-secondary)] mb-3 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[var(--primary-200)] pl-4 py-1 my-3 text-sm text-[var(--text-secondary)] italic">
              {children}
            </blockquote>
          ),
          code: ({ className: codeClassName, children, ...props }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code className="px-1.5 py-0.5 rounded bg-[var(--primary-50)] text-[var(--primary-600)] text-xs font-mono">
                  {children}
                </code>
              );
            }
            return (
              <code className={`${codeClassName || ''} text-xs`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-[#1e1e2e] text-[#cdd6f4] rounded-lg p-4 overflow-x-auto my-3 text-xs">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full text-xs border border-[var(--primary-50)]">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-[var(--primary-50)] bg-[var(--primary-50)] px-3 py-2 text-left font-semibold text-[var(--text-primary)]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-[var(--primary-50)] px-3 py-2 text-[var(--text-secondary)]">
              {children}
            </td>
          ),
          input: ({ type, checked, ...props }) => {
            if (type === 'checkbox') {
              return (
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  className="mr-2 rounded border-[var(--primary-200)] text-[var(--primary-500)]"
                  {...props}
                />
              );
            }
            return <input type={type} {...props} />;
          },
          a: ({ href, children }) => (
            <a href={href} className="text-[var(--primary-500)] hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt || ''} className="max-w-full rounded-lg my-3" />
          ),
          hr: () => <hr className="my-6 border-[var(--primary-50)]" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
