'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Principle, SpaceKey } from '@/lib/domain/types';
import { PrincipleItem } from './PrincipleItem';

interface PrinciplesListProps {
  spaceKey: SpaceKey;
  color: string;
}

export function PrinciplesList({ spaceKey, color }: PrinciplesListProps) {
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [newText, setNewText] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchPrinciples = useCallback(async () => {
    try {
      const res = await fetch(`/api/principles?space=${spaceKey}`);
      if (!res.ok) return;
      const data = (await res.json()) as { principles: Principle[] };
      setPrinciples(data.principles);
    } catch {
      // Silently fail
    }
  }, [spaceKey]);

  useEffect(() => {
    fetchPrinciples();
  }, [fetchPrinciples]);

  const handleConfirm = async (id: string) => {
    try {
      await fetch(`/api/principles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmed: true }),
      });
      setPrinciples((prev) => prev.map((p) => (p.id === id ? { ...p, confirmed: true } : p)));
    } catch {
      // Silently fail
    }
  };

  const handleUpdate = async (id: string, text: string) => {
    try {
      await fetch(`/api/principles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      setPrinciples((prev) => prev.map((p) => (p.id === id ? { ...p, text } : p)));
    } catch {
      // Silently fail
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      await fetch(`/api/principles/${id}`, { method: 'DELETE' });
      setPrinciples((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // Silently fail
    }
  };

  const handleAdd = async () => {
    const trimmed = newText.trim();
    if (!trimmed) return;

    setAdding(true);
    try {
      const res = await fetch('/api/principles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spaceKey, text: trimmed }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { principle: Principle };
      setPrinciples((prev) => [data.principle, ...prev]);
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

  const MAX_VISIBLE = 5;
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? principles : principles.slice(0, MAX_VISIBLE);
  const hiddenCount = principles.length - MAX_VISIBLE;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] tracking-widest text-white/30 uppercase">Principles</span>

      {visible.map((p) => (
        <PrincipleItem
          key={p.id}
          principle={p}
          color={color}
          onConfirm={handleConfirm}
          onUpdate={handleUpdate}
          onDismiss={handleDismiss}
        />
      ))}

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="py-1 text-[11px] text-white/25 transition-colors hover:text-white/40"
        >
          {expanded ? 'Show less' : `+${hiddenCount} more`}
        </button>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a principle..."
          disabled={adding}
          className="flex-1 rounded-lg border border-white/5 bg-transparent px-3 py-2 text-xs text-white/60 placeholder:text-white/15 focus:border-white/15 focus:outline-none"
        />
        {newText.trim() && (
          <button
            type="button"
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
