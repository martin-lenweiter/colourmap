import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithRetry } from '@/lib/utils/fetch-with-retry';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetch(...responses: Array<Response | Error>) {
  let call = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const r = responses[call++] ?? responses[responses.length - 1];
      if (r instanceof Error) throw r;
      return r;
    }),
  );
}

function ok() {
  return new Response('ok', { status: 200 });
}

describe('fetchWithRetry', () => {
  it('returns response immediately on success', async () => {
    mockFetch(ok());
    const res = await fetchWithRetry('http://x');
    expect(res.status).toBe(200);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it('retries after network error and succeeds', async () => {
    mockFetch(new Error('network'), ok());
    const promise = fetchWithRetry('http://x', { retries: 1 });
    await vi.runAllTimersAsync();
    const res = await promise;
    expect(res.status).toBe(200);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting all retries', async () => {
    mockFetch(new Error('network'));
    const promise = fetchWithRetry('http://x', { retries: 2 });
    const assertion = expect(promise).rejects.toThrow('network');
    await vi.runAllTimersAsync();
    await assertion;
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it('aborts and retries on timeout', async () => {
    let aborted = false;
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init: RequestInit) => {
        return new Promise((_resolve, reject) => {
          (init.signal as AbortSignal).addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }),
    );

    const promise = fetchWithRetry('http://x', { timeoutMs: 100, retries: 0 });
    const assertion = expect(promise).rejects.toThrow();
    await vi.runAllTimersAsync();
    await assertion;
    expect(aborted).toBe(true);
  });

  it('uses exponential backoff: 500ms then 1000ms', async () => {
    mockFetch(new Error('a'), new Error('b'), ok());
    const promise = fetchWithRetry('http://x', { retries: 2 });

    // First backoff: 500 * 2^0 = 500ms
    await vi.advanceTimersByTimeAsync(499);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    // Second attempt fires, then second backoff: 500 * 2^1 = 1000ms
    await vi.advanceTimersByTimeAsync(999);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);

    await promise;
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });
});
