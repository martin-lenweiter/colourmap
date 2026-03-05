'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DriftInfo, SpaceKey, UserState } from '@/lib/domain/types';
import { ChatPanel } from './ChatPanel';

interface FloatingChatProps {
  sessionId: string;
  onStateUpdate: (newState: UserState) => void;
  initialContext?: string;
  onContextSent?: () => void;
  driftInfo?: DriftInfo;
  onDriftSpaceClick?: (space: SpaceKey) => void;
  space?: SpaceKey;
}

export function FloatingChat({
  sessionId,
  onStateUpdate,
  initialContext,
  onContextSent,
  driftInfo,
  onDriftSpaceClick,
  space,
}: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLButtonElement>(null);
  const isOpenRef = useRef(isOpen);

  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  const handleAssistantMessage = useCallback(() => {
    if (!isOpenRef.current) {
      setHasUnread(true);
    }
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) setHasUnread(false);
      return !prev;
    });
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        bubbleRef.current &&
        !bubbleRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    // Delay to avoid catching the toggle click
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onClick);
    };
  }, [isOpen]);

  return (
    <>
      {/* Panel — always mounted, visually hidden when closed */}
      <div
        ref={panelRef}
        className={`fixed right-6 bottom-20 z-40 flex origin-bottom-right flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[#060a12]/95 backdrop-blur-xl transition-all duration-300 ${
          isOpen
            ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
            : 'pointer-events-none translate-y-4 scale-95 opacity-0'
        } max-md:fixed max-md:inset-0 max-md:right-0 max-md:bottom-0 max-md:rounded-none max-md:border-0 md:h-[min(600px,80vh)] md:w-[420px]`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <span className="text-[13px] font-light tracking-wide text-white/40">
            {space ? space.charAt(0).toUpperCase() + space.slice(1) : 'Chat'}
          </span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/30 transition-colors hover:bg-white/5 hover:text-white/50 md:hidden"
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Chat content */}
        <div className="min-h-0 flex-1">
          <ChatPanel
            sessionId={sessionId}
            onStateUpdate={onStateUpdate}
            initialContext={initialContext}
            onContextSent={onContextSent}
            driftInfo={driftInfo}
            onDriftSpaceClick={onDriftSpaceClick}
            compact
            space={space}
            onAssistantMessage={handleAssistantMessage}
          />
        </div>
      </div>

      {/* Bubble trigger */}
      <button
        type="button"
        ref={bubbleRef}
        onClick={toggle}
        className="fixed right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] backdrop-blur-md transition-all hover:bg-white/[0.1]"
      >
        {/* Unread indicator */}
        {hasUnread && !isOpen && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 animate-pulse rounded-full bg-teal-400" />
        )}

        {isOpen ? (
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-60"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="opacity-60"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </>
  );
}
