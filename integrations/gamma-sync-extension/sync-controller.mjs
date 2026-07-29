export class SupersededSyncError extends Error {
  constructor() {
    super('A newer Gamma card replaced this synchronization request.');
    this.name = 'SupersededSyncError';
  }
}

function abortError() {
  const error = new Error('Synchronization was aborted.');
  error.name = 'AbortError';
  return error;
}

export function waitForRetry(delayMs, signal) {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, delayMs);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeout);
        reject(abortError());
      },
      { once: true },
    );
  });
}

export async function retryTransient(operation, options = {}) {
  const delays = options.delays ?? [250, 750, 1500];
  const isRetryable = options.isRetryable ?? (() => true);
  let retries = 0;

  for (;;) {
    if (options.signal?.aborted) throw abortError();
    try {
      return { value: await operation(retries), retries };
    } catch (error) {
      if (options.signal?.aborted || error?.name === 'AbortError') throw error;
      if (retries >= delays.length || !isRetryable(error)) throw error;
      await options.onRetry?.(error, retries + 1);
      await waitForRetry(delays[retries], options.signal);
      retries += 1;
    }
  }
}

/**
 * Serializes presenter mutations while retaining only the newest waiting request.
 * An in-flight request is aborted when a newer Gamma card arrives; even if the
 * server already accepted the old command, the newest command runs immediately
 * afterwards and restores the authoritative final position.
 */
export function createLatestWinsController(executor) {
  let latestSequence = 0;
  let pending = null;
  let running = false;
  let activeAbort = null;

  async function drain() {
    if (running) return;
    running = true;
    try {
      while (pending) {
        const request = pending;
        pending = null;
        activeAbort = new AbortController();
        try {
          const result = await executor(request.payload, {
            sequence: request.sequence,
            signal: activeAbort.signal,
            isLatest: () => request.sequence === latestSequence,
          });
          if (request.sequence !== latestSequence) {
            request.resolve({ ok: false, superseded: true });
          } else {
            request.resolve(result);
          }
        } catch (error) {
          if (request.sequence !== latestSequence || error?.name === 'AbortError') {
            request.resolve({ ok: false, superseded: true });
          } else {
            request.reject(error);
          }
        } finally {
          activeAbort = null;
        }
      }
    } finally {
      running = false;
      if (pending) void drain();
    }
  }

  function submit(payload) {
    latestSequence += 1;
    const sequence = latestSequence;
    activeAbort?.abort();
    if (pending) pending.resolve({ ok: false, superseded: true });

    return new Promise((resolve, reject) => {
      pending = { payload, sequence, resolve, reject };
      void drain();
    });
  }

  return {
    submit,
    get latestSequence() {
      return latestSequence;
    },
  };
}
