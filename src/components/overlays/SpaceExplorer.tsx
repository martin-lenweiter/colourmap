'use client';

import { useEffect, useState } from 'react';
import type { SpaceKey, UserState } from '@/lib/domain/types';
import { FloatingChat } from '../chat/FloatingChat';
import { FocusList } from '../ui/FocusList';
import { PrinciplesList } from '../ui/PrinciplesList';
import { StateTimeline } from './StateTimeline';

interface HistoryPoint {
  attention: number;
  alignment: number;
  date: string;
}

interface SpaceExplorerProps {
  space: SpaceKey;
  state: UserState;
  onStateUpdate: (newState: UserState) => void;
  onBack: () => void;
}

const SPACE_CONFIG: Record<SpaceKey, { label: string; color: string; gradient: string }> = {
  health: {
    label: 'Health',
    color: 'rgb(64, 224, 208)',
    gradient: 'from-teal-500/20 to-transparent',
  },
  connection: {
    label: 'Connection',
    color: 'rgb(255, 130, 150)',
    gradient: 'from-rose-400/20 to-transparent',
  },
  purpose: {
    label: 'Purpose',
    color: 'rgb(255, 191, 64)',
    gradient: 'from-amber-400/20 to-transparent',
  },
};

export function SpaceExplorer({ space, state, onStateUpdate, onBack }: SpaceExplorerProps) {
  const [historyPoints, setHistoryPoints] = useState<HistoryPoint[] | null>(null);

  const config = SPACE_CONFIG[space];
  const spaceState = state[space];

  useEffect(() => {
    fetch(`/api/state/history?space=${space}`)
      .then((r) => r.json())
      .then((d: { points: HistoryPoint[] }) => {
        const pts = d.points;
        // Anchor last point to current state so chart endpoint matches bars
        const last = pts[pts.length - 1];
        if (last) {
          pts[pts.length - 1] = {
            ...last,
            attention: spaceState.attention,
            alignment: spaceState.alignment,
          };
        }
        setHistoryPoints(pts);
      })
      .catch(() => setHistoryPoints([]));
  }, [space, spaceState.attention, spaceState.alignment]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#060a12]">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-white/5 px-6 py-4">
        <button
          type="button"
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-3">
          <div
            className="h-3 w-3 rounded-full"
            style={{ background: config.color, opacity: 0.7 }}
          />
          <h1 className="text-lg font-light tracking-wide text-white/70">{config.label}</h1>
        </div>
      </div>

      {/* State dashboard — full width, centered */}
      <div className="flex-1 overflow-y-auto px-6 py-5" style={{ scrollbarWidth: 'none' }}>
        <div className="mx-auto max-w-2xl">
          <div className="flex flex-col gap-1">
            <span className="group relative cursor-default text-[11px] tracking-widest text-white/30 uppercase">
              Attention
              <span className="pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 rounded bg-white/10 px-2 py-1 text-[10px] font-normal tracking-normal whitespace-nowrap text-white/60 normal-case opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                Energy given to this space
              </span>
            </span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-full max-w-32 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${spaceState.attention * 100}%`,
                    background: config.color,
                    opacity: 0.6,
                  }}
                />
              </div>
              <span className="text-xs text-white/40">
                {(spaceState.attention * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-1">
            <span className="group relative cursor-default text-[11px] tracking-widest text-white/30 uppercase">
              Alignment
              <span className="pointer-events-none absolute top-1/2 left-full ml-2 -translate-y-1/2 rounded bg-white/10 px-2 py-1 text-[10px] font-normal tracking-normal whitespace-nowrap text-white/60 normal-case opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                Actions match your principles
              </span>
            </span>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-full max-w-32 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${spaceState.alignment * 100}%`,
                    background: config.color,
                    opacity: 0.6,
                  }}
                />
              </div>
              <span className="text-xs text-white/40">
                {(spaceState.alignment * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Tone tags */}
          {spaceState.tone.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {spaceState.tone.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/40"
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Tensions */}
          {spaceState.tensions.length > 0 && (
            <div className="mt-4 flex flex-col gap-1.5">
              <span className="text-[11px] tracking-widest text-white/30 uppercase">Tensions</span>
              {spaceState.tensions.map((t) => (
                <span key={t} className="text-xs text-white/50">
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Sparkline trends */}
          {historyPoints === null && (
            <div className="mt-5 flex flex-col gap-4">
              <div className="h-16 animate-pulse rounded bg-white/[0.04]" />
              <div className="h-16 animate-pulse rounded bg-white/[0.04]" />
            </div>
          )}
          {historyPoints !== null && historyPoints.length >= 2 && (
            <div className="mt-5 flex flex-col gap-4">
              <StateTimeline
                points={historyPoints.map((p) => ({
                  value: p.attention,
                  date: p.date,
                }))}
                color={config.color}
                label="Attention trend"
              />
              <StateTimeline
                points={historyPoints.map((p) => ({
                  value: p.alignment,
                  date: p.date,
                }))}
                color={config.color.replace('rgb(', 'rgba(').replace(')', ', 0.6)')}
                label="Alignment trend"
              />
            </div>
          )}

          {/* Principles */}
          <div className="mt-5">
            <PrinciplesList spaceKey={space} color={config.color} />
          </div>

          {/* Focus Areas */}
          <div className="mt-5">
            <FocusList spaceKey={space} />
          </div>
        </div>
      </div>

      {/* Floating chat for space exploration */}
      <FloatingChat key={space} sessionId="auto" onStateUpdate={onStateUpdate} space={space} />
    </div>
  );
}
