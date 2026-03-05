'use client';

import { useEffect, useState } from 'react';
import { GenerativeCanvas } from '@/components/canvas/GenerativeCanvas';
import { FloatingChat } from '@/components/chat/FloatingChat';
import { CheckInOverlay } from '@/components/overlays/CheckInOverlay';
import { CompassView } from '@/components/overlays/CompassView';
import { DataControlsView } from '@/components/overlays/DataControlsView';
import { HistoryPanel } from '@/components/overlays/HistoryPanel';
import { OnboardingOverlay } from '@/components/overlays/OnboardingOverlay';
import { SpaceExplorer } from '@/components/overlays/SpaceExplorer';
import {
  trackCheckInCompleted,
  trackCheckInSkipped,
  trackDataDeleted,
  trackDataExported,
  trackNavToFutureMe,
  trackOnboardingCompleted,
  trackOnboardingError,
} from '@/lib/analytics';
import { DEFAULT_USER_STATE } from '@/lib/domain/state';
import type { DriftInfo, SpaceKey, UserState } from '@/lib/domain/types';

function buildDriftContext(state: UserState, drift: DriftInfo): string | undefined {
  const driftingSpaces: string[] = [];
  for (const space of ['health', 'connection', 'purpose'] as const) {
    const sd = drift[space];
    if (sd.isDrifting) {
      const reasons: string[] = [];
      if (sd.staleDays > 2)
        reasons.push(`hasn't been discussed in ${Math.round(sd.staleDays)} days`);
      if (state[space].alignment < 0.3)
        reasons.push(`alignment is low at ${(state[space].alignment * 100).toFixed(0)}%`);
      driftingSpaces.push(`${space} (${reasons.join(', ')})`);
    }
  }
  if (driftingSpaces.length === 0) return undefined;

  driftingSpaces.sort((a, b) => {
    const aMatch = a.match(/(\d+) days/);
    const bMatch = b.match(/(\d+) days/);
    return Number(bMatch?.[1] ?? 0) - Number(aMatch?.[1] ?? 0);
  });
  const primary = driftingSpaces[0];
  return `The user is returning. Their most drifting space is ${primary}. ${driftingSpaces.length > 1 ? `Also drifting: ${driftingSpaces.slice(1).join('; ')}.` : ''} Open by gently naming what you notice about ${primary?.split(' (')[0]} specifically — one observation, one question. Be warm but direct.`;
}

export default function ColourMapPage() {
  const [userState, setUserState] = useState<UserState>(DEFAULT_USER_STATE);
  const [hasOnboarded, setHasOnboarded] = useState<boolean | null>(null);
  const [onboardingContext, setOnboardingContext] = useState<string | undefined>();
  const [driftInfo, setDriftInfo] = useState<DriftInfo | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [activeSpace, setActiveSpace] = useState<SpaceKey | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showCompass, setShowCompass] = useState(false);
  const [showDataControls, setShowDataControls] = useState(false);

  useEffect(() => {
    fetch('/api/state')
      .then((res) => res.json())
      .then(
        (data: {
          state: UserState | null;
          hasOnboarded: boolean;
          drift: DriftInfo | null;
          lastSessionAt: string | null;
        }) => {
          if (data.hasOnboarded && data.state) {
            setUserState(data.state);
            setHasOnboarded(true);
            if (data.drift) {
              setDriftInfo(data.drift);
            }

            const hoursSinceLastSession = data.lastSessionAt
              ? (Date.now() - new Date(data.lastSessionAt).getTime()) / (1000 * 60 * 60)
              : Infinity;

            if (hoursSinceLastSession >= 8) {
              setShowCheckIn(true);
            } else if (data.drift) {
              const ctx = buildDriftContext(data.state, data.drift);
              if (ctx) setOnboardingContext(ctx);
            }
          } else {
            setHasOnboarded(false);
          }
        },
      )
      .catch(() => {
        setHasOnboarded(false);
      });
  }, []);

  if (hasOnboarded === null) return null;

  const handleOnboardingComplete = async (seededState: UserState, uploadedContext?: string) => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: seededState }),
      });
      if (!res.ok) throw new Error('Failed to save onboarding state');

      let finalState = seededState;
      if (uploadedContext?.trim()) {
        const journalRes = await fetch('/api/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: uploadedContext.trim() }),
        });
        if (journalRes.ok) {
          const data = (await journalRes.json()) as { newState: UserState };
          finalState = data.newState;
        }
      }

      setUserState(finalState);
      setHasOnboarded(true);
      trackOnboardingCompleted(!!uploadedContext?.trim());
      setOnboardingContext(
        `The user just completed onboarding. Their initial self-assessment: health feels ${finalState.health.tone.join(', ')}, relationships feel ${finalState.connection.tone.join(', ')}, sense of purpose feels ${finalState.purpose.tone.join(', ')}. Energy: ${(finalState.energy * 100).toFixed(0)}%. Start with a warm, personalized opening based on what they shared.`,
      );
    } catch (err) {
      trackOnboardingError(err);
      setUserState(seededState);
      setHasOnboarded(true);
      trackOnboardingCompleted(false);
      setOnboardingContext(
        `The user just completed onboarding. Their initial self-assessment: health feels ${seededState.health.tone.join(', ')}, relationships feel ${seededState.connection.tone.join(', ')}, sense of purpose feels ${seededState.purpose.tone.join(', ')}. Energy: ${(seededState.energy * 100).toFixed(0)}%. Start with a warm, personalized opening based on what they shared.`,
      );
    }
  };

  const handleCheckInComplete = (context: string) => {
    trackCheckInCompleted();
    setOnboardingContext(context);
    setShowCheckIn(false);
  };

  const handleCheckInSkip = () => {
    trackCheckInSkipped();
    setShowCheckIn(false);
    if (driftInfo && userState) {
      const ctx = buildDriftContext(userState, driftInfo);
      if (ctx) setOnboardingContext(ctx);
    }
  };

  const overlay = activeSpace || showHistory || showCompass || showDataControls;

  return (
    <>
      {/* Main canvas — full viewport, hidden behind overlays */}
      <div
        className="relative h-screen w-screen overflow-hidden bg-[#060a12]"
        style={{ display: overlay ? 'none' : undefined }}
      >
        {/* Background depth gradient */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse 70% 60% at 30% 45%, #0a1628 0%, transparent 70%)',
          }}
        />

        {/* Canvas — fills viewport */}
        <div className="absolute inset-0">
          <GenerativeCanvas
            state={userState}
            drift={driftInfo ?? undefined}
            onOrbClick={setActiveSpace}
          />
        </div>

        {/* Compass button — fixed top-left */}
        {hasOnboarded && (
          <button
            type="button"
            aria-label="View compass"
            onClick={() => setShowCompass(true)}
            className="fixed top-5 left-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white/70"
          >
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polygon
                points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"
                fill="currentColor"
                fillOpacity="0.3"
              />
            </svg>
          </button>
        )}

        {/* History button — fixed top-right */}
        {hasOnboarded && (
          <button
            type="button"
            aria-label="View history"
            onClick={() => setShowHistory(true)}
            className="fixed top-5 right-5 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/[0.08] hover:text-white/70"
          >
            <svg
              aria-hidden="true"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </button>
        )}

        {/* Data controls + portfolio nav — fixed bottom-left */}
        {hasOnboarded && (
          <div className="fixed bottom-5 left-5 z-30 flex flex-wrap items-center gap-4 text-xs">
            <button
              type="button"
              aria-label="Data and privacy"
              onClick={() => setShowDataControls(true)}
              className="text-white/30 transition-colors hover:text-white/50"
            >
              Data & privacy
            </button>
            <a
              href={process.env.NEXT_PUBLIC_FUTUREME_URL ?? 'https://futureme.app'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/30 transition-colors hover:text-white/50"
              onClick={trackNavToFutureMe}
            >
              FutureMe
            </a>
          </div>
        )}

        {/* Floating chat bubble */}
        <FloatingChat
          sessionId="auto"
          onStateUpdate={setUserState}
          initialContext={onboardingContext}
          onContextSent={() => setOnboardingContext(undefined)}
          driftInfo={driftInfo ?? undefined}
          onDriftSpaceClick={setActiveSpace}
        />

        {/* Onboarding overlay */}
        {!hasOnboarded && <OnboardingOverlay onComplete={handleOnboardingComplete} />}

        {/* Daily check-in overlay */}
        {showCheckIn && (
          <CheckInOverlay
            onComplete={handleCheckInComplete}
            onSkip={handleCheckInSkip}
            driftInfo={driftInfo}
          />
        )}
      </div>

      {/* Compass overlay */}
      {showCompass && <CompassView onBack={() => setShowCompass(false)} />}

      {/* Data controls overlay */}
      {showDataControls && (
        <DataControlsView
          onBack={() => setShowDataControls(false)}
          onTrackExport={trackDataExported}
          onTrackDelete={trackDataDeleted}
        />
      )}

      {/* Explorer overlay */}
      {activeSpace && (
        <SpaceExplorer
          space={activeSpace}
          state={userState}
          onStateUpdate={setUserState}
          onBack={() => setActiveSpace(null)}
        />
      )}

      {/* History overlay */}
      {showHistory && <HistoryPanel onClose={() => setShowHistory(false)} />}
    </>
  );
}
