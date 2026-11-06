import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET } from '../src/app/health/route.ts';

test('health route returns a public liveness response', async () => {
  const response = GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });
});
