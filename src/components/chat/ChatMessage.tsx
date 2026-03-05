'use client';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  compact?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export function ChatMessage({ role, content, compact, isError, onRetry }: ChatMessageProps) {
  const isUser = role === 'user';

  if (compact) {
    return (
      <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
        <div
          className={`max-w-full text-[13px] leading-[1.6] whitespace-pre-wrap ${
            isUser
              ? 'px-0 py-1.5 text-white/80'
              : 'border-l-2 border-white/[0.06] py-1.5 pl-3 text-white/70'
          } ${isError ? 'rounded border border-amber-500/30 px-2' : ''}`}
        >
          {content}
          {isError && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 block text-xs text-amber-400 hover:underline"
              aria-label="Retry sending message"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6`}>
      <div
        className={`max-w-[80%] rounded-2xl px-5 py-4 text-[15px] leading-[1.7] whitespace-pre-wrap ${
          isUser ? 'bg-white/10 text-white' : 'bg-white/[0.03] text-white/90'
        } ${isError ? 'border border-amber-500/30' : ''}`}
      >
        {content}
        {isError && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 block rounded-lg bg-amber-500/20 px-3 py-1.5 text-sm text-amber-400 hover:bg-amber-500/30"
            aria-label="Retry sending message"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
