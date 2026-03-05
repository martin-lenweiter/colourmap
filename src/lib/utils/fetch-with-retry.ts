/**
 * Fetch with timeout and retries (2 retries, exponential backoff).
 * Used for /api/chat (30s) and /api/voice/* (15s).
 */
export interface FetchWithRetryOptions extends Omit<RequestInit, 'signal'> {
  timeoutMs?: number;
  retries?: number;
}

export async function fetchWithRetry(
  url: string,
  options: FetchWithRetryOptions = {},
): Promise<Response> {
  const { timeoutMs = 30000, retries = 2, ...init } = options;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      lastErr = err;
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
  }
  throw lastErr;
}
