import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOptimisticAction } from '../src/firebase/optimisticAction.ts';
test('optimistic state appears before acknowledgement; failure rolls back and unlocks', async () => {
  const run = createOptimisticAction();
  let state = false;
  let reject!: (error: Error) => void;
  const pending = run(() => { state = true; }, () => new Promise((_, fail) => { reject = fail; }), () => { state = false; });
  assert.equal(state, true);
  let duplicateWrite = false;
  assert.equal(await run(() => {}, async () => { duplicateWrite = true; }, () => {}), false);
  assert.equal(duplicateWrite, false);
  reject(new Error('permission-denied'));
  await assert.rejects(pending);
  assert.equal(state, false);
  assert.equal(await run(() => { state = true; }, async () => {}, () => { state = false; }), true);
  assert.equal(state, true);
});
