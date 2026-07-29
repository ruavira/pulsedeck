import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLatestWinsController,
  retryTransient,
  waitForRetry,
} from './sync-controller.mjs';

test('latest navigation aborts an in-flight request and becomes authoritative', async () => {
  const executed = [];
  const controller = createLatestWinsController(async (value, context) => {
    executed.push(value);
    if (value === 'old-card') await waitForRetry(1000, context.signal);
    return { ok: true, value };
  });

  const oldResult = controller.submit('old-card');
  await new Promise((resolve) => setTimeout(resolve, 5));
  const newResult = controller.submit('new-card');

  assert.deepEqual(await oldResult, { ok: false, superseded: true });
  assert.deepEqual(await newResult, { ok: true, value: 'new-card' });
  assert.deepEqual(executed, ['old-card', 'new-card']);
});

test('only the newest waiting navigation is retained', async () => {
  const executed = [];
  const controller = createLatestWinsController(async (value, context) => {
    executed.push(value);
    if (value === 'first') await waitForRetry(1000, context.signal);
    return { ok: true, value };
  });

  const first = controller.submit('first');
  await new Promise((resolve) => setTimeout(resolve, 5));
  const middle = controller.submit('middle');
  const final = controller.submit('final');

  assert.deepEqual(await first, { ok: false, superseded: true });
  assert.deepEqual(await middle, { ok: false, superseded: true });
  assert.deepEqual(await final, { ok: true, value: 'final' });
  assert.deepEqual(executed, ['first', 'final']);
});

test('transient operations retry with bounded backoff', async () => {
  let attempts = 0;
  const result = await retryTransient(
    async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('temporary');
      return 'healthy';
    },
    { delays: [1, 1], isRetryable: () => true },
  );

  assert.equal(result.value, 'healthy');
  assert.equal(result.retries, 2);
  assert.equal(attempts, 3);
});

test('non-transient operations fail without retrying', async () => {
  let attempts = 0;
  await assert.rejects(
    retryTransient(
      async () => {
        attempts += 1;
        throw new Error('permanent');
      },
      { delays: [1, 1], isRetryable: () => false },
    ),
    /permanent/,
  );
  assert.equal(attempts, 1);
});
