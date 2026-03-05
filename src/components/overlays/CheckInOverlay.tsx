'use client';

import { useState, useCallback, useEffect } from 'react';
import type { DriftInfo } from '@/lib/domain/types';

interface CheckInOverlayProps {
  onComplete: (context: string) => void;
  onSkip: () => void;
  driftInfo: DriftInfo | null;
}

type Phase = 'enter' | 'questions' | 'exit';
type SpaceKey = 'health' | 'connection' | 'purpose';

const ENERGY_OPTIONS = [
  { label: 'Buzzing', value: 0.8 },
  { label: 'Steady', value: 0.5 },
  { label: 'Low', value: 0.3 },
  { label: 'Running on fumes', value: 0.1 },
] as const;

const FOCUS_OPTIONS = [
  { label: 'Health', space: 'health' as SpaceKey, color: '#2dd4bf' },
  { label: 'Connection', space: 'connection' as SpaceKey, color: '#fb7185' },
  { label: 'Purpose', space: 'purpose' as SpaceKey, color: '#fbbf24' },
] as const;

const SPACE_COLORS: Record<SpaceKey, string> = {
  health: '#2dd4bf',
  connection: '#fb7185',
  purpose: '#fbbf24',
};

const SPACE_QUESTIONS: Record<
  SpaceKey,
  { label: string; options: { label: string; tone: string[] }[] }
> = {
  health: {
    label: "How's your body?",
    options: [
      { label: 'Strong', tone: ['strong', 'energized'] },
      { label: 'Fine', tone: ['steady'] },
      { label: 'Stressed', tone: ['stressed', 'tight'] },
      { label: 'Heavy', tone: ['heavy', 'exhausted'] },
    ],
  },
  connection: {
    label: "How's your heart?",
    options: [
      { label: 'Warm', tone: ['warm', 'connected'] },
      { label: 'Quiet', tone: ['quiet', 'steady'] },
      { label: 'Lonely', tone: ['lonely', 'distant'] },
      { label: 'Tangled', tone: ['tangled', 'conflicted'] },
    ],
  },
  purpose: {
    label: "How's your direction?",
    options: [
      { label: 'Clear', tone: ['clear', 'driven'] },
      { label: 'Exploring', tone: ['curious', 'open'] },
      { label: 'Foggy', tone: ['foggy', 'uncertain'] },
      { label: 'Stuck', tone: ['stuck', 'searching'] },
    ],
  },
};

const GENERAL_QUESTION = {
  label: 'How are you feeling overall?',
  options: [
    { label: 'Grounded', tone: ['grounded', 'centered'] },
    { label: 'Mixed', tone: ['mixed', 'uneven'] },
    { label: 'Scattered', tone: ['scattered', 'restless'] },
    { label: 'Flat', tone: ['flat', 'numb'] },
  ],
};

// Spread positions match GenerativeCanvas orb layout (health top-left, connection top-right, purpose bottom-center)
const CIRCLE_SPREAD = [
  { x: '-30vw', y: '-25vh' },
  { x: '30vw', y: '-28vh' },
  { x: '0vw', y: '28vh' },
];

const CIRCLE_COLORS = ['#2dd4bf', '#fb7185', '#fbbf24'];

export function CheckInOverlay({
  onComplete,
  onSkip,
  driftInfo,
}: CheckInOverlayProps) {
  const [phase, setPhase] = useState<Phase>('enter');
  const [step, setStep] = useState(0);
  const [energy, setEnergy] = useState<number | null>(null);
  const [focusSpace, setFocusSpace] = useState<SpaceKey | null>(null);
  const [fading, setFading] = useState(false);
  const [converged, setConverged] = useState(false);
  const [skipFading, setSkipFading] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setConverged(true));
    return () => cancelAnimationFrame(t);
  }, []);

  useEffect(() => {
    if (converged) {
      const t = setTimeout(() => setPhase('questions'), 1200);
      return () => clearTimeout(t);
    }
  }, [converged]);

  const buildContextString = useCallback(
    (finalTone: string[]) => {
      const energyLabel =
        energy !== null && energy >= 0.6
          ? 'high'
          : energy !== null && energy >= 0.4
            ? 'moderate'
            : 'low';
      const energyPct =
        energy !== null ? `${Math.round(energy * 100)}%` : '50%';
      const driftSection = driftInfo
        ? (() => {
            const drifting = (
              ['health', 'connection', 'purpose'] as const
            ).filter((s) => driftInfo[s].isDrifting && s !== focusSpace);
            return drifting.length > 0
              ? `\nDrifting spaces: ${drifting.join(', ')}.`
              : '';
          })()
        : '';

      const focusLabel =
        focusSpace === null ? 'all three spaces equally' : `${focusSpace} most`;

      return `The user completed a daily check-in. Energy: ${energyLabel} (${energyPct}). ${focusLabel} is pulling their attention. They described feeling ${finalTone.join(', ')}.${driftSection} Open with a brief acknowledgment of how they're arriving, then gently move toward ${focusSpace ?? 'whatever feels most alive'}. Be warm but direct.`;
    },
    [energy, focusSpace, driftInfo]
  );

  const handleEnergySelect = useCallback((value: number) => {
    setEnergy(value);
    setFading(true);
    setTimeout(() => {
      setStep(1);
      setFading(false);
    }, 300);
  }, []);

  const handleFocusSelect = useCallback((space: SpaceKey | null) => {
    setFocusSpace(space);
    setFading(true);
    setTimeout(() => {
      setStep(2);
      setFading(false);
    }, 300);
  }, []);

  const handleToneSelect = useCallback(
    (selected: string[]) => {
      setFading(true);
      setTimeout(() => {
        setPhase('exit');
        setConverged(false);
        setTimeout(() => {
          onComplete(buildContextString(selected));
        }, 900);
      }, 400);
    },
    [onComplete, buildContextString]
  );

  const handleSkip = useCallback(() => {
    setSkipFading(true);
    setTimeout(() => onSkip(), 300);
  }, [onSkip]);

  const totalSteps = 3;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Daily check-in"
      className={`fixed inset-0 z-50 flex items-center justify-center transition-opacity ${
        skipFading || phase === 'exit'
          ? 'opacity-0 duration-700'
          : 'opacity-100 duration-500'
      }`}
      style={{
        background:
          'radial-gradient(ellipse 80% 70% at 50% 45%, #060a12 0%, #060a12 100%)',
      }}
    >
      {/* Animated circles */}
      {CIRCLE_COLORS.map((color, i) => (
        <div
          key={i}
          className="pointer-events-none fixed"
          style={{
            width:
              phase === 'exit'
                ? 'clamp(160px, 30vw, 280px)'
                : 'clamp(120px, 25vw, 200px)',
            height:
              phase === 'exit'
                ? 'clamp(160px, 30vw, 280px)'
                : 'clamp(120px, 25vw, 200px)',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
            boxShadow: `0 0 ${converged ? 80 : 40}px ${color}30`,
            left: '50%',
            top: '50%',
            transform: converged
              ? 'translate(-50%, -50%)'
              : `translate(calc(-50% + ${CIRCLE_SPREAD[i]?.x ?? '0px'}), calc(-50% + ${CIRCLE_SPREAD[i]?.y ?? '0px'}))`,
            transition: 'all 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
            filter:
              phase === 'exit'
                ? 'blur(45px)'
                : converged
                  ? 'blur(30px)'
                  : 'blur(15px)',
          }}
        />
      ))}

      {/* Question content */}
      {phase === 'questions' && (
        <div
          className={`relative z-10 flex max-w-md flex-col items-center gap-8 px-6 transition-opacity duration-300 ${
            fading ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {/* Progress dots */}
          <div className="flex gap-2" aria-hidden="true">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 w-8 rounded-full transition-colors duration-300 ${
                  i <= step ? 'bg-white/30' : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* Step 0: Energy */}
          {step === 0 && (
            <>
              <p className="text-center text-lg font-light text-white/70">
                How are you arriving?
              </p>
              <div className="flex w-full flex-col gap-3">
                {ENERGY_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => handleEnergySelect(opt.value)}
                    className="min-h-[44px] rounded-xl border border-white/10 bg-white/[0.03] px-6 py-4 text-sm text-white/60 transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white/80"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 1: Focus space */}
          {step === 1 && (
            <>
              <p className="text-center text-lg font-light text-white/70">
                What's pulling your attention?
              </p>
              <div className="flex w-full items-center justify-center gap-6">
                {FOCUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.space}
                    onClick={() => handleFocusSelect(opt.space)}
                    className="group flex min-h-[44px] min-w-[44px] flex-col items-center gap-2"
                  >
                    <div
                      className="h-14 w-14 rounded-full transition-transform group-hover:scale-110"
                      style={{
                        background: `radial-gradient(circle, ${opt.color}60 0%, ${opt.color}20 70%)`,
                        boxShadow: `0 0 20px ${opt.color}30`,
                      }}
                    />
                    <span className="text-xs text-white/40 transition-colors group-hover:text-white/60">
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleFocusSelect(null)}
                className="min-h-[44px] rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm text-white/40 transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white/60"
              >
                Everything
              </button>
            </>
          )}

          {/* Step 2: Space-specific or general tone */}
          {step === 2 &&
            (() => {
              const q = focusSpace
                ? SPACE_QUESTIONS[focusSpace]
                : GENERAL_QUESTION;
              const accent = focusSpace ? SPACE_COLORS[focusSpace] : null;
              return (
                <>
                  <p
                    className="text-center text-lg font-light"
                    style={{
                      color: accent ? `${accent}cc` : 'rgba(255,255,255,0.7)',
                    }}
                  >
                    {q.label}
                  </p>
                  <div className="flex w-full flex-col gap-3">
                    <style>{`
                      .checkin-tone-btn:hover {
                        border-color: var(--btn-border-hover) !important;
                        background-color: var(--btn-bg-hover) !important;
                        color: var(--btn-color-hover) !important;
                      }
                    `}</style>
                    {q.options.map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => handleToneSelect(opt.tone)}
                        className="checkin-tone-btn min-h-[44px] rounded-xl border px-6 py-4 text-sm transition-all"
                        style={
                          {
                            '--btn-border': accent
                              ? `${accent}18`
                              : 'rgba(255,255,255,0.1)',
                            '--btn-border-hover': accent
                              ? `${accent}30`
                              : 'rgba(255,255,255,0.2)',
                            '--btn-bg': accent
                              ? `${accent}06`
                              : 'rgba(255,255,255,0.03)',
                            '--btn-bg-hover': accent
                              ? `${accent}10`
                              : 'rgba(255,255,255,0.06)',
                            '--btn-color': accent
                              ? `${accent}aa`
                              : 'rgba(255,255,255,0.6)',
                            '--btn-color-hover': accent
                              ? `${accent}dd`
                              : 'rgba(255,255,255,0.8)',
                            borderColor: 'var(--btn-border)',
                            backgroundColor: 'var(--btn-bg)',
                            color: 'var(--btn-color)',
                          } as React.CSSProperties
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              );
            })()}
        </div>
      )}

      {/* Skip link */}
      {phase === 'questions' && (
        <button
          onClick={handleSkip}
          className="fixed bottom-8 left-1/2 z-10 min-h-[44px] -translate-x-1/2 text-sm text-white/20 transition-colors hover:text-white/40"
        >
          skip
        </button>
      )}
    </div>
  );
}
