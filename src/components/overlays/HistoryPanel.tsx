'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChatMessage } from '../chat/ChatMessage';

interface Session {
  id: string;
  summary: string | null;
  created_at: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface HistoryPanelProps {
  onClose: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function HistoryPanel({ onClose }: HistoryPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sessionsError, setSessionsError] = useState(false);
  const [messagesError, setMessagesError] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [correctedSummary, setCorrectedSummary] = useState('');
  const [savingCorrection, setSavingCorrection] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions');
      if (!res.ok) {
        setSessionsError(true);
        return;
      }
      const data = (await res.json()) as { sessions: Session[] };
      setSessions(data.sessions);
    } catch {
      setSessionsError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleSelectSession = async (sessionId: string) => {
    setMessages([]);
    setSelectedSession(sessionId);
    setMessagesError(false);
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/messages`);
      if (!res.ok) {
        setMessagesError(true);
        return;
      }
      const data = (await res.json()) as { messages: Message[] };
      setMessages(data.messages);

      // Lazily generate summary if missing or corrupted
      const session = sessions.find((s) => s.id === sessionId);
      const needsSummary =
        !session?.summary ||
        session.summary.includes('---') ||
        session.summary.includes('**Summary:**') ||
        session.summary.length > 200;
      if (session && needsSummary) {
        fetch(`/api/sessions/${sessionId}/summary`, { method: 'POST' })
          .then((r) => r.json())
          .then((d: { summary: string | null }) => {
            if (d.summary) {
              setSessions((prev) =>
                prev.map((s) => (s.id === sessionId ? { ...s, summary: d.summary } : s)),
              );
            }
          })
          .catch(() => {
            // Summary generation is best-effort
          });
      }
    } catch {
      setMessagesError(true);
    } finally {
      setLoadingMessages(false);
    }
  };

  const activeSession = selectedSession ? sessions.find((s) => s.id === selectedSession) : null;

  const handleStartCorrect = () => {
    if (activeSession?.summary) {
      setCorrectedSummary(activeSession.summary);
      setEditingSummary(true);
    }
  };

  const handleSaveCorrection = async () => {
    if (!selectedSession || !correctedSummary.trim()) return;
    setSavingCorrection(true);
    try {
      const res = await fetch(`/api/sessions/${selectedSession}/summary`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correctedSummary: correctedSummary.trim() }),
      });
      if (res.ok) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === selectedSession ? { ...s, summary: correctedSummary.trim() } : s,
          ),
        );
        setEditingSummary(false);
      }
    } catch {
      // Best-effort
    } finally {
      setSavingCorrection(false);
    }
  };

  const handleCancelCorrect = () => {
    setEditingSummary(false);
    setCorrectedSummary('');
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#060a12]">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-white/5 px-6 py-4">
        <button
          type="button"
          onClick={selectedSession ? () => setSelectedSession(null) : onClose}
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
        <h1 className="flex-1 text-lg font-light tracking-wide text-white/70">
          {activeSession
            ? editingSummary
              ? 'Edit summary'
              : (activeSession.summary ?? formatDate(activeSession.created_at))
            : 'History'}
        </h1>
        {activeSession?.summary && !editingSummary && (
          <button
            type="button"
            onClick={handleStartCorrect}
            className="text-xs text-white/40 transition-colors hover:text-white/60"
            aria-label="Correct summary"
          >
            Correct
          </button>
        )}
      </div>

      {activeSession && editingSummary && (
        <div className="border-b border-white/5 px-6 py-4">
          <textarea
            value={correctedSummary}
            onChange={(e) => setCorrectedSummary(e.target.value)}
            className="mb-3 min-h-[80px] w-full rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/70 focus:border-white/20 focus:outline-none"
            placeholder="Correct the summary..."
            rows={3}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancelCorrect}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveCorrection}
              disabled={savingCorrection || !correctedSummary.trim()}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white/90 hover:bg-white/15 disabled:opacity-50"
            >
              {savingCorrection ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2 border-b border-white/5 px-6 py-4">
                <div className="h-3 w-20 animate-pulse rounded bg-white/[0.06]" />
                <div className="h-4 w-40 animate-pulse rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        )}

        {!loading && !selectedSession && sessionsError && (
          <div className="px-6 py-20 text-center text-sm text-white/30">
            {"Couldn't load sessions"}
          </div>
        )}

        {!loading && !selectedSession && !sessionsError && (
          <div className="flex flex-col">
            {sessions.length === 0 && (
              <div className="px-6 py-20 text-center text-sm text-white/30">No sessions yet</div>
            )}
            {sessions.map((session) => (
              <button
                type="button"
                key={session.id}
                onClick={() => handleSelectSession(session.id)}
                className="flex flex-col gap-1 border-b border-white/5 px-6 py-4 text-left transition-colors hover:bg-white/[0.02]"
              >
                <span className="text-xs text-white/30">{formatDate(session.created_at)}</span>
                <span className="line-clamp-2 text-sm text-white/60">
                  {session.summary ?? 'Check-in session'}
                </span>
              </button>
            ))}
          </div>
        )}

        {selectedSession && (
          <div className="px-6 py-6">
            {messagesError && (
              <div className="py-10 text-center text-sm text-white/30">
                {"Couldn't load messages"}
              </div>
            )}
            {loadingMessages && !messagesError && (
              <div className="flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <div className="h-4 w-48 animate-pulse rounded bg-white/[0.04]" />
                    <div className="h-4 w-32 animate-pulse rounded bg-white/[0.04]" />
                  </div>
                ))}
              </div>
            )}
            {!loadingMessages &&
              !messagesError &&
              messages.map((msg, i) => (
                <ChatMessage key={i} role={msg.role} content={msg.content} />
              ))}
            {!loadingMessages && !messagesError && messages.length === 0 && (
              <div className="py-10 text-center text-sm text-white/30">
                No messages in this session
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
