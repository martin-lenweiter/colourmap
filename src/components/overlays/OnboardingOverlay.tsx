'use client';

import { useCallback, useState } from 'react';
import { DEFAULT_USER_STATE } from '@/lib/domain/state';
import type { UserState } from '@/lib/domain/types';

interface OnboardingOverlayProps {
  onComplete: (seededState: UserState, uploadedContext?: string) => void;
}

interface QuestionOption {
  label: string;
  attention: number;
  alignment: number;
  tone: string[];
}

interface Question {
  label: string;
  space: 'health' | 'connection' | 'purpose';
  options: QuestionOption[];
}

const QUESTIONS: Question[] = [
  {
    label: 'How\u2019s your body feeling?',
    space: 'health',
    options: [
      {
        label: 'Energized',
        attention: 0.85,
        alignment: 0.8,
        tone: ['energized', 'strong'],
      },
      { label: 'Okay', attention: 0.55, alignment: 0.5, tone: ['steady'] },
      { label: 'Tired', attention: 0.35, alignment: 0.35, tone: ['fatigued'] },
      {
        label: 'Drained',
        attention: 0.15,
        alignment: 0.2,
        tone: ['exhausted', 'heavy'],
      },
    ],
  },
  {
    label: 'How are your closest relationships?',
    space: 'connection',
    options: [
      {
        label: 'Connected',
        attention: 0.75,
        alignment: 0.85,
        tone: ['warm', 'close'],
      },
      { label: 'Stable', attention: 0.5, alignment: 0.6, tone: ['steady'] },
      {
        label: 'Distant',
        attention: 0.3,
        alignment: 0.3,
        tone: ['disconnected'],
      },
      {
        label: 'Strained',
        attention: 0.1,
        alignment: 0.15,
        tone: ['tense', 'conflicted'],
      },
    ],
  },
  {
    label: 'How clear is your direction?',
    space: 'purpose',
    options: [
      {
        label: 'Focused',
        attention: 0.9,
        alignment: 0.75,
        tone: ['clear', 'driven'],
      },
      {
        label: 'Exploring',
        attention: 0.6,
        alignment: 0.45,
        tone: ['curious', 'open'],
      },
      { label: 'Foggy', attention: 0.25, alignment: 0.3, tone: ['uncertain'] },
      {
        label: 'Lost',
        attention: 0.1,
        alignment: 0.1,
        tone: ['confused', 'searching'],
      },
    ],
  },
];

const WELCOME_STEP = 0;
const CONTEXT_UPLOAD_STEP = QUESTIONS.length + 1;

export function OnboardingOverlay({ onComplete }: OnboardingOverlayProps) {
  const [step, setStep] = useState(WELCOME_STEP);
  const [answers, setAnswers] = useState<
    Record<string, { attention: number; alignment: number; tone: string[] }>
  >({});
  const [uploadedText, setUploadedText] = useState('');
  const [fading, setFading] = useState(false);

  const buildSeededState = useCallback(
    (ans: Record<string, { attention: number; alignment: number; tone: string[] }>) => ({
      health: {
        attention: ans.health?.attention ?? DEFAULT_USER_STATE.health.attention,
        tone: ans.health?.tone ?? [],
        alignment: ans.health?.alignment ?? 0.5,
        tensions: [],
      },
      connection: {
        attention: ans.connection?.attention ?? DEFAULT_USER_STATE.connection.attention,
        tone: ans.connection?.tone ?? [],
        alignment: ans.connection?.alignment ?? 0.5,
        tensions: [],
      },
      purpose: {
        attention: ans.purpose?.attention ?? DEFAULT_USER_STATE.purpose.attention,
        tone: ans.purpose?.tone ?? [],
        alignment: ans.purpose?.alignment ?? 0.5,
        tensions: [],
      },
      energy:
        ((ans.health?.attention ?? 0.5) +
          (ans.connection?.attention ?? 0.5) +
          (ans.purpose?.attention ?? 0.5)) /
        3,
      clarity: ((ans.health?.attention ?? 0.5) + (ans.purpose?.attention ?? 0.5)) / 2,
    }),
    [],
  );

  const handleWelcomeNext = useCallback(() => {
    setFading(true);
    setTimeout(() => {
      setStep(1);
      setFading(false);
    }, 300);
  }, []);

  const handleSelect = useCallback(
    (option: QuestionOption) => {
      const question = QUESTIONS[step - 1];
      if (!question) return;
      const newAnswers = {
        ...answers,
        [question.space]: {
          attention: option.attention,
          alignment: option.alignment,
          tone: option.tone,
        },
      };
      setAnswers(newAnswers);

      if (step < QUESTIONS.length) {
        setFading(true);
        setTimeout(() => {
          setStep(step + 1);
          setFading(false);
        }, 300);
      } else {
        setFading(true);
        setTimeout(() => {
          setStep(CONTEXT_UPLOAD_STEP);
          setFading(false);
        }, 300);
      }
    },
    [step, answers],
  );

  const handleContextSkip = useCallback(() => {
    const seeded = buildSeededState(answers);
    setFading(true);
    setTimeout(() => onComplete(seeded), 500);
  }, [answers, buildSeededState, onComplete]);

  const handleContextAdd = useCallback(() => {
    const seeded = buildSeededState(answers);
    const text = uploadedText.trim();
    setFading(true);
    setTimeout(() => onComplete(seeded, text || undefined), 500);
  }, [answers, buildSeededState, uploadedText, onComplete]);

  const question = step > 0 && step <= QUESTIONS.length ? QUESTIONS[step - 1] : null;
  const isWelcomeStep = step === WELCOME_STEP;
  const isContextStep = step === CONTEXT_UPLOAD_STEP;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse 80% 70% at 50% 45%, #060a12 0%, #060a12 100%)',
      }}
    >
      <div
        className={`flex max-w-md flex-col items-center gap-8 px-6 transition-opacity duration-300 ${
          fading ? 'opacity-0' : 'opacity-100'
        }`}
      >
        <div className="flex gap-2">
          {[null, ...QUESTIONS, null].map((_, i) => (
            <div
              key={i}
              className={`h-1 w-8 rounded-full transition-colors duration-300 ${
                i <= step ? 'bg-white/30' : 'bg-white/10'
              }`}
            />
          ))}
        </div>

        {isWelcomeStep ? (
          <>
            <p id="onboarding-title" className="text-center text-xl font-light text-white/80">
              Colour Map helps you stay aligned with what matters.
            </p>
            <p className="text-center text-sm text-white/50">
              A living map of three spaces: health, love, and purpose. You check in daily, and the
              map reflects where you are.
            </p>
            <p className="text-center text-xs text-white/40">
              Not therapy. Not a tracker. Not medical advice. A place to see yourself clearly.
            </p>
            <button
              type="button"
              onClick={handleWelcomeNext}
              aria-label="Start onboarding"
              className="mt-4 rounded-xl border border-white/20 bg-white/10 px-8 py-4 text-sm text-white/90 transition-all hover:bg-white/15 focus:ring-2 focus:ring-white/30 focus:outline-none"
            >
              Let&apos;s get started
            </button>
          </>
        ) : isContextStep ? (
          <>
            <p className="text-center text-lg font-light text-white/70">
              If you have existing journals, values documents, or notes about how you want to live,
              you can share them here. This helps me understand you faster, but it&apos;s completely
              optional.
            </p>
            <textarea
              value={uploadedText}
              onChange={(e) => setUploadedText(e.target.value)}
              placeholder="Paste markdown, text, or notes..."
              aria-label="Optional context: journals, values, or notes"
              className="min-h-[120px] w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70 placeholder:text-white/30 focus:border-white/20 focus:outline-none"
              rows={5}
            />
            <div className="flex w-full gap-3">
              <button
                type="button"
                onClick={handleContextSkip}
                className="flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-4 text-sm text-white/60 transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white/80"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleContextAdd}
                className="flex-1 rounded-xl border border-white/20 bg-white/10 px-6 py-4 text-sm text-white/90 transition-all hover:bg-white/15"
              >
                Add context
              </button>
            </div>
          </>
        ) : question ? (
          <>
            <p className="text-center text-lg font-light text-white/70">{question.label}</p>
            <div className="flex w-full flex-col gap-3">
              {question.options.map((option) => (
                <button
                  type="button"
                  key={option.label}
                  onClick={() => handleSelect(option)}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-4 text-sm text-white/60 transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-white/80"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
