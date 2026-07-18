/**
 * fetch() wrapper that adds a timeout and honors an optional caller AbortSignal
 * (e.g. to cancel on component unmount). On timeout it rejects with a friendly
 * "timed out" error; when the caller aborts, the underlying request is aborted.
 */
export async function fetchWithTimeout(
  url: string,
  opts: { signal?: AbortSignal; timeoutMs?: number; init?: RequestInit } = {},
): Promise<Response> {
  const { signal, timeoutMs = 15000, init } = opts;
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeoutMs);

  const onAbort = () => ctrl.abort();
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e) {
    if (timedOut) throw new Error('Request timed out. Check your connection and try again.', { cause: e });
    throw e;
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}
