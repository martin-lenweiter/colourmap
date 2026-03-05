'use client';

import type { FocusItem } from '@/lib/domain/types';

interface FocusCardProps {
  item: FocusItem;
  onUpdateStatus: (id: string, status: FocusItem['status']) => void;
}

export function FocusCard({ item, onUpdateStatus }: FocusCardProps) {
  const isProposed = item.status === 'proposed';
  const isActive = item.status === 'active';

  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm leading-snug text-white/70">{item.text}</span>
        <span className="text-[10px] text-white/25">
          {item.source === 'coach' ? 'suggested by coach' : 'your focus'}
        </span>
      </div>

      <div className="flex gap-2">
        {isProposed && (
          <button
            type="button"
            onClick={() => onUpdateStatus(item.id, 'active')}
            className="min-h-[44px] rounded-lg border border-white/10 px-4 py-2.5 text-xs text-white/50 transition-colors hover:border-white/20 hover:text-white/70"
          >
            Accept
          </button>
        )}
        {isActive && (
          <button
            type="button"
            onClick={() => onUpdateStatus(item.id, 'completed')}
            className="min-h-[44px] rounded-lg border border-white/10 px-4 py-2.5 text-xs text-white/50 transition-colors hover:border-teal-500/30 hover:text-teal-400/70"
          >
            Done
          </button>
        )}
        {(isProposed || isActive) && (
          <button
            type="button"
            onClick={() => onUpdateStatus(item.id, 'archived')}
            className="min-h-[44px] rounded-lg px-3 py-2.5 text-xs text-white/25 transition-colors hover:text-white/40"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
