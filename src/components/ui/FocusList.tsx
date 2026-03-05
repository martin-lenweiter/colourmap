'use client';

import { useState, useEffect, useCallback } from 'react';
import { FocusCard } from './FocusCard';
import type { FocusItem, SpaceKey } from '@/lib/domain/types';

interface FocusListProps {
  spaceKey: SpaceKey;
}

export function FocusList({ spaceKey }: FocusListProps) {
  const [items, setItems] = useState<FocusItem[]>([]);
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`/api/focus?space=${spaceKey}`);
      if (!res.ok) return;
      const data = (await res.json()) as { focusItems: FocusItem[] };
      setItems(data.focusItems);
    } catch {
      // Silently fail
    }
  }, [spaceKey]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleUpdateStatus = async (
    id: string,
    status: FocusItem['status']
  ) => {
    try {
      await fetch(`/api/focus/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      setItems((prev) =>
        status === 'archived'
          ? prev.filter((f) => f.id !== id)
          : prev.map((f) => (f.id === id ? { ...f, status } : f))
      );
    } catch {
      // Silently fail
    }
  };

  const handleAdd = async () => {
    const trimmed = newText.trim();
    if (!trimmed) return;

    setAdding(true);
    try {
      const res = await fetch('/api/focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceKey, text: trimmed }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { focusItem: FocusItem };
      setItems((prev) => [data.focusItem, ...prev]);
      setNewText('');
    } catch {
      // Silently fail
    } finally {
      setAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  const active = items.filter(
    (f) => f.status === 'active' || f.status === 'proposed'
  );
  const completed = items.filter((f) => f.status === 'completed');

  const MAX_ACTIVE = 4;
  const [expandedActive, setExpandedActive] = useState(false);
  const visibleActive = expandedActive ? active : active.slice(0, MAX_ACTIVE);
  const hiddenActiveCount = active.length - MAX_ACTIVE;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] tracking-widest text-white/30 uppercase">
        Focus Areas
      </span>

      {visibleActive.map((f) => (
        <FocusCard key={f.id} item={f} onUpdateStatus={handleUpdateStatus} />
      ))}

      {hiddenActiveCount > 0 && (
        <button
          onClick={() => setExpandedActive(!expandedActive)}
          className="py-1 text-[11px] text-white/25 transition-colors hover:text-white/40"
        >
          {expandedActive ? 'Show less' : `+${hiddenActiveCount} more`}
        </button>
      )}

      {completed.length > 0 && (
        <div className="flex flex-col gap-2">
          {completed.slice(0, 3).map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white/30 line-through"
            >
              {f.text}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a focus area..."
          disabled={adding}
          className="flex-1 rounded-lg border border-white/5 bg-transparent px-3 py-2 text-xs text-white/60 placeholder:text-white/15 focus:border-white/15 focus:outline-none"
        />
        {newText.trim() && (
          <button
            onClick={handleAdd}
            disabled={adding}
            className="min-h-[44px] min-w-[44px] text-xs text-white/40 transition-colors hover:text-white/60"
          >
            Add
          </button>
        )}
      </div>
    </div>
  );
}
