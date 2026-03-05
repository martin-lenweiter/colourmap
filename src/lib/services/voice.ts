export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'pcm' | 'opus';

export interface VoiceInfo {
  id: string;
  name?: string;
  description?: string;
  language?: string;
  gender?: string;
}

export interface TranscribeResult {
  text: string;
  segments?: { text: string; startMs?: number; endMs?: number }[];
}

export interface SynthesizeResult {
  audio: Uint8Array;
  contentType: string;
}

export function mimeToFormat(mime: string): AudioFormat {
  if (mime.includes('webm') || mime.includes('opus')) return 'opus';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mp3') || mime.includes('mpeg')) return 'mp3';
  return 'ogg';
}

export function isSttConfigured(): boolean {
  return Boolean(process.env.MISTRAL_API_KEY);
}

export function isTtsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

/** Transcribe audio via Mistral Voxtral. Returns null if STT not configured. */
export async function transcribe(
  audioData: Uint8Array,
  format: AudioFormat,
  language = 'en',
): Promise<TranscribeResult | null> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) return null;

  const ext = format === 'opus' ? 'ogg' : format;
  const mimeMap: Record<string, string> = {
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    pcm: 'audio/pcm',
  };
  const mimeType = mimeMap[ext] ?? 'audio/ogg';

  const formData = new FormData();
  formData.append('file', new Blob([audioData.buffer as ArrayBuffer], { type: mimeType }), `audio.${ext}`);
  formData.append('model', 'voxtral-mini-2507');
  formData.append('language', language);

  const res = await fetch('https://api.mistral.ai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Mistral STT error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as { text: string; segments?: unknown[] };
  return { text: data.text ?? '' };
}

/** Synthesize text via ElevenLabs. Returns null if TTS not configured. */
export async function synthesize(
  text: string,
  voiceId?: string,
): Promise<SynthesizeResult | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return null;

  const vid = voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? '21m00Tcm4TlvDq8ikWAM';

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`ElevenLabs TTS error ${res.status}: ${err}`);
  }

  const buffer = await res.arrayBuffer();
  return { audio: new Uint8Array(buffer), contentType: 'audio/mpeg' };
}

/** List available TTS voices. Returns empty array if TTS not configured. */
export async function listVoices(): Promise<VoiceInfo[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return [];

  const res = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as {
    voices: { voice_id: string; name: string; labels?: Record<string, string> }[];
  };

  return (data.voices ?? []).map((v) => ({
    id: v.voice_id,
    name: v.name,
    gender: v.labels?.gender,
    language: v.labels?.language,
  }));
}
