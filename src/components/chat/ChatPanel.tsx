'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { VoiceInput } from '../voice/VoiceInput';
import { fetchWithRetry } from '@/lib/utils/fetch-with-retry';
import type { UserState, StateDelta, SpaceKey } from '@/lib/domain/types';
import type { DriftInfo } from '@/lib/domain/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
  onRetry?: () => void;
}

const SPACE_DOT_COLORS: Record<SpaceKey, string> = {
  health: 'rgb(64, 224, 208)',
  connection: 'rgb(255, 130, 150)',
  purpose: 'rgb(255, 191, 64)',
};

function DriftNotice({
  driftInfo,
  onSpaceClick,
}: {
  driftInfo: DriftInfo;
  onSpaceClick?: (space: SpaceKey) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  const drifting = (['health', 'connection', 'purpose'] as const).filter(
    (s) => driftInfo[s].isDrifting
  );
  if (drifting.length === 0) return null;

  return (
    <div className="mb-4 flex items-center gap-2 rounded-lg bg-white/[0.03] px-4 py-3">
      <div className="flex items-center gap-1.5">
        {drifting.map((s) => (
          <button
            key={s}
            onClick={() => {
              onSpaceClick?.(s);
              setDismissed(true);
            }}
            className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-white/50 transition-colors hover:bg-white/5 hover:text-white/70"
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: SPACE_DOT_COLORS[s], opacity: 0.5 }}
            />
            {s}
          </button>
        ))}
      </div>
      <span className="text-xs text-white/25">quiet lately</span>
    </div>
  );
}

interface ChatPanelProps {
  sessionId: string;
  onStateUpdate: (newState: UserState) => void;
  initialContext?: string;
  onContextSent?: () => void;
  driftInfo?: DriftInfo;
  onDriftSpaceClick?: (space: SpaceKey) => void;
  compact?: boolean;
  space?: SpaceKey;
  onAssistantMessage?: () => void;
}

export function ChatPanel({
  sessionId,
  onStateUpdate,
  initialContext,
  onContextSent,
  driftInfo,
  onDriftSpaceClick,
  compact,
  space,
  onAssistantMessage,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (messages.length > 0) return;

    // Space-scoped auto-send (for SpaceExplorer usage)
    if (space && !initialContext) {
      const autoSend = async () => {
        setIsLoading(true);
        try {
          const res = await fetchWithRetry('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `I'd like to explore my ${space} space more deeply.`,
              history: [],
              space,
              isSystemContext: true,
            }),
            timeoutMs: 30000,
          });
          if (!res.ok) throw new Error('Failed');
          const data = (await res.json()) as {
            response: string;
            newState: UserState;
          };
          setMessages([{ role: 'assistant', content: data.response }]);
          onAssistantMessage?.();
        } catch {
          // Silently fail
        } finally {
          setIsLoading(false);
        }
      };
      autoSend();
      return;
    }

    // Context-based auto-send (for onboarding/drift)
    if (!initialContext) return;

    const autoSend = async () => {
      setIsLoading(true);
      try {
        const res = await fetchWithRetry('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: initialContext,
            sessionId,
            history: [],
            isSystemContext: true,
          }),
          timeoutMs: 30000,
        });
        if (!res.ok) throw new Error('Failed');
        const data = (await res.json()) as {
          response: string;
          newState: UserState;
        };
        setMessages([{ role: 'assistant', content: data.response }]);
        onStateUpdate(data.newState);
        onContextSent?.();
        onAssistantMessage?.();
      } catch {
        // Silently fail — user can still type manually
      } finally {
        setIsLoading(false);
      }
    };
    autoSend();
  }, [initialContext, space]); // intentionally limited deps — only fire on context/space change

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const target = e.target;
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
  };

  const sendMessage = useCallback(
    async (historyOverride?: Message[]) => {
      const trimmed = input.trim();
      if (!trimmed || isLoading) return;

      const isRetry = !!historyOverride;
      const history = historyOverride ?? messages.filter((m) => !m.isError);
      const userMessage: Message = { role: 'user', content: trimmed };

      if (!isRetry) {
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
      }
      setIsLoading(true);

      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }

      try {
        const res = await fetchWithRetry('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            sessionId,
            history: history.map((m) => ({ role: m.role, content: m.content })),
            ...(space ? { space } : {}),
          }),
          timeoutMs: 30000,
        });

        if (!res.ok) {
          throw new Error('Failed to send message');
        }

        const data = (await res.json()) as {
          response: string;
          stateDeltas: StateDelta;
          newState: UserState;
        };

        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: data.response },
        ]);

        onStateUpdate(data.newState);
        onAssistantMessage?.();
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setInput(trimmed);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: "Something went wrong. Let's try again.",
            isError: true,
            onRetry: () => {
              setMessages((p) => [...p.slice(0, -2), userMessage]);
              sendMessage(history);
            },
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      input,
      isLoading,
      messages,
      sessionId,
      space,
      onStateUpdate,
      onAssistantMessage,
    ]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const placeholder = space
    ? `Explore your ${space}...`
    : "Share what's on your mind...";

  return (
    <div className="flex h-full flex-col">
      <div
        className={`flex-1 overflow-y-auto ${compact ? 'px-4 pt-4 pb-3' : 'px-6 pt-14 pb-8'}`}
        style={{ scrollbarWidth: 'none' }}
      >
        {driftInfo && messages.length <= 1 && !compact && (
          <DriftNotice driftInfo={driftInfo} onSpaceClick={onDriftSpaceClick} />
        )}
        {messages.length === 0 && !compact && (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <p className="text-[15px] font-light text-white/40">
              What&apos;s been on your mind lately?
            </p>
            <p className="text-xs tracking-wide text-white/20">
              across health, connection, and purpose
            </p>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage
            key={i}
            role={msg.role}
            content={msg.content}
            compact={compact}
            isError={msg.isError}
            onRetry={msg.onRetry}
          />
        ))}
        {isLoading && (
          <div className={`${compact ? 'mb-3' : 'mb-6'} flex flex-col gap-3`}>
            <div className="flex justify-start">
              <div className="h-4 w-48 animate-pulse rounded-lg bg-white/[0.06]" />
            </div>
            <div className="flex justify-start">
              <div className="h-4 w-32 animate-pulse rounded-lg bg-white/[0.04]" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div
        className={`border-t border-white/5 ${compact ? 'px-4 py-3' : 'px-6 py-4'}`}
      >
        {!compact && (
          <div className="flex items-center justify-end">
            <span
              className={`text-xs text-white/50 transition-opacity duration-500 ${
                saveStatus === 'saved' ? 'opacity-100' : 'opacity-0'
              }`}
            >
              Saved
            </span>
          </div>
        )}
        <div
          role="group"
          tabIndex={0}
          className="flex cursor-text items-end gap-3"
          onClick={() => inputRef.current?.focus()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.focus();
            }
          }}
          aria-label="Message input area"
        >
          <VoiceInput
            onTranscription={(text) => {
              setInput((prev) => (prev ? `${prev} ${text}` : text));
              inputRef.current?.focus();
            }}
            disabled={isLoading}
            className="shrink-0"
          />
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={1}
            className={`flex-1 resize-none bg-transparent text-white placeholder:text-white/20 focus:outline-none ${
              compact ? 'text-[13px]' : 'text-sm'
            }`}
          />
          <button
            aria-label="Send message"
            onClick={() => sendMessage()}
            disabled={!input.trim() || isLoading}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center transition-colors ${
              input.trim()
                ? 'text-teal-400/70 hover:text-teal-300 disabled:text-white/10'
                : 'text-white/20 disabled:text-white/10'
            }`}
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
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
