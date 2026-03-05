'use client';

import { useState, useEffect } from 'react';
import { PrinciplesList } from '../ui/PrinciplesList';
import { FocusList } from '../ui/FocusList';
import type { CompassReading, SpaceKey } from '@/lib/domain/types';

interface CompassViewProps {
  onBack: () => void;
}

const SPACE_CONFIG: Record<SpaceKey, { label: string; color: string }> = {
  health: { label: 'Health', color: 'rgb(64, 224, 208)' },
  connection: { label: 'Connection', color: 'rgb(255, 130, 150)' },
  purpose: { label: 'Purpose', color: 'rgb(255, 191, 64)' },
};

const SPACES: SpaceKey[] = ['health', 'connection', 'purpose'];

export function CompassView({ onBack }: CompassViewProps) {
  const [reading, setReading] = useState<CompassReading | null>(null);
  const [loadingReading, setLoadingReading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch('/api/compass')
      .then((r) => r.json())
      .then((data: { reading: CompassReading | null; fresh: boolean }) => {
        if (data.reading) {
          setReading(data.reading);
        } else {
          // No reading exists — generate one
          generateReading();
        }
      })
      .catch(() => {
        // Network error — ignore
      })
      .finally(() => setLoadingReading(false));
  }, []);

  const generateReading = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/compass', { method: 'POST' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        reading: CompassReading;
      };
      setReading(data.reading);
    } catch {
      // Silently fail
    } finally {
      setRefreshing(false);
      setLoadingReading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#060a12]">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-white/5 px-6 py-4">
        <button
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/5 hover:text-white/70"
        >
          <svg
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
        <h1 className="text-lg font-light tracking-wide text-white/70">
          Compass
        </h1>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto px-6 py-6"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="mx-auto max-w-5xl">
          {/* Three-column layout */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {SPACES.map((space) => {
              const config = SPACE_CONFIG[space];
              return (
                <div key={space} className="flex flex-col gap-5">
                  {/* Space header */}
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: config.color, opacity: 0.7 }}
                    />
                    <span className="text-sm font-medium tracking-wide text-white/60">
                      {config.label}
                    </span>
                  </div>

                  {/* Principles for this space */}
                  <PrinciplesList spaceKey={space} color={config.color} />

                  {/* Focus items for this space */}
                  <FocusList spaceKey={space} />
                </div>
              );
            })}
          </div>

          {/* Compass Reading */}
          <div className="mt-8 rounded-2xl border border-white/5 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between">
              <span className="text-[11px] tracking-widest text-white/30 uppercase">
                Compass Reading
              </span>
              <button
                onClick={generateReading}
                disabled={refreshing}
                className="min-h-[44px] rounded-lg px-3 py-2 text-[11px] text-white/25 transition-colors hover:text-white/50 disabled:opacity-50"
              >
                {refreshing ? 'Generating...' : 'Refresh'}
              </button>
            </div>

            {loadingReading || refreshing ? (
              <div className="mt-4 flex flex-col gap-3">
                <div className="h-4 w-full animate-pulse rounded bg-white/[0.04]" />
                <div className="h-4 w-4/5 animate-pulse rounded bg-white/[0.04]" />
                <div className="h-4 w-3/5 animate-pulse rounded bg-white/[0.04]" />
              </div>
            ) : reading ? (
              <div className="mt-4 flex flex-col gap-5">
                {/* Narrative */}
                <p className="text-sm leading-relaxed text-white/50">
                  {reading.narrative}
                </p>

                {/* Reinforcements */}
                {reading.reinforcements.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] tracking-widest text-white/20 uppercase">
                      Reinforcements
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {reading.reinforcements.map((r, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-emerald-500/15 bg-emerald-500/5 px-3 py-1.5 text-[11px] text-emerald-400/60"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tensions */}
                {reading.tensions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] tracking-widest text-white/20 uppercase">
                      Tensions
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {reading.tensions.map((t, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-amber-500/15 bg-amber-500/5 px-3 py-1.5 text-[11px] text-amber-400/60"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-white/30">
                No reading available yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
