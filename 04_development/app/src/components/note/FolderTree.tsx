'use client';

import React, { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
}

interface FolderTreeProps {
  nodes: TreeNode[];
  selectedPath?: string;
  onSelect: (path: string) => void;
}

function TreeItem({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: TreeNode;
  depth: number;
  selectedPath?: string;
  onSelect: (path: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isFolder = node.type === 'folder';
  const isSelected = node.path === selectedPath;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer text-xs',
          'hover:bg-[var(--primary-50)] transition-colors',
          isSelected && 'bg-[var(--primary-50)] text-[var(--primary-600)] font-medium'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (isFolder) {
            setExpanded(!expanded);
          } else {
            onSelect(node.path);
          }
        }}
      >
        {isFolder ? (
          expanded ? <ChevronDown className="w-3 h-3 text-[var(--text-tertiary)]" /> : <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)]" />
        ) : (
          <span className="w-3" />
        )}
        {isFolder ? (
          <Folder className="w-3.5 h-3.5 text-[var(--primary-400)]" />
        ) : (
          <FileText className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
        )}
        <span className="truncate">{node.name}</span>
      </div>

      {isFolder && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FolderTree({ nodes, selectedPath, onSelect }: FolderTreeProps) {
  return (
    <div className="py-2">
      {nodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
