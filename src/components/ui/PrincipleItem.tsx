'use client';

import { useState } from 'react';
import type { Principle } from '@/lib/domain/types';

interface PrincipleItemProps {
  principle: Principle;
  color: string;
  onConfirm: (id: string) => void;
  onUpdate: (id: string, text: string) => void;
  onDismiss: (id: string) => void;
}

export function PrincipleItem({
  principle,
  color,
  onConfirm,
  onUpdate,
  onDismiss,
}: PrincipleItemProps) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(principle.text);

  const handleSave = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== principle.text) {
      onUpdate(principle.id, trimmed);
    }
    setEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setEditText(principle.text);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          className="flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2 text-xs text-white/70 focus:border-white/20 focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
      <div
        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: color, opacity: principle.confirmed ? 0.7 : 0.3 }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span
          className={`text-sm leading-snug ${principle.confirmed ? 'text-white/60' : 'text-white/40 italic'}`}
        >
          {principle.text}
        </span>
        {!principle.confirmed && (
          <span className="text-[10px] text-white/20">proposed by coach</span>
        )}
      </div>
      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {!principle.confirmed && (
          <button
            onClick={() => onConfirm(principle.id)}
            className="min-h-[44px] min-w-[44px] rounded-lg px-2 py-1 text-[11px] text-white/30 transition-colors hover:text-white/60"
          >
            Confirm
          </button>
        )}
        <button
          onClick={() => setEditing(true)}
          className="min-h-[44px] min-w-[44px] rounded-lg px-2 py-1 text-[11px] text-white/20 transition-colors hover:text-white/40"
        >
          Edit
        </button>
        <button
          onClick={() => onDismiss(principle.id)}
          className="min-h-[44px] min-w-[44px] rounded-lg px-2 py-1 text-[11px] text-white/20 transition-colors hover:text-white/40"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
