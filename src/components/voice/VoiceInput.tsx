'use client';

import { useState, useRef, useCallback } from 'react';
import { fetchWithRetry } from '@/lib/utils/fetch-with-retry';

interface VoiceInputProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceInput({
  onTranscription,
  disabled,
  className = '',
}: VoiceInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        if (blob.size < 100) return;

        try {
          const formData = new FormData();
          formData.append('audio', blob);
          const res = await fetchWithRetry('/api/voice/transcribe', {
            method: 'POST',
            body: formData,
            timeoutMs: 15000,
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(
              data.error ?? "Couldn't hear that — try typing instead"
            );
          }
          const data = (await res.json()) as { text: string };
          if (data.text?.trim()) onTranscription(data.text.trim());
        } catch (err) {
          const msg =
            err instanceof Error
              ? err.name === 'AbortError'
                ? 'Transcription timed out — try typing instead'
                : err.message
              : "Couldn't hear that — try typing instead";
          setError(msg);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }, [onTranscription]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  }, []);

  const toggle = useCallback(() => {
    if (disabled) return;
    if (isRecording) stopRecording();
    else startRecording();
  }, [disabled, isRecording, startRecording, stopRecording]);

  return (
    <div className={className}>
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-label={isRecording ? 'Stop recording' : 'Start voice input'}
        className="flex h-10 w-10 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/5 hover:text-white/70 disabled:opacity-40 disabled:hover:bg-transparent"
      >
        {isRecording ? (
          <span className="flex h-3 w-3 animate-pulse rounded-full bg-red-400" />
        ) : (
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
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        )}
      </button>
      {error && (
        <p className="mt-1 text-xs text-amber-400/80" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
