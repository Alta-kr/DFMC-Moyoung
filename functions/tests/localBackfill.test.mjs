import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { rehearseLocalBackfill } from '../src/localBackfill.js';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
test('isolated backfill compares home/feed, preserves counts on rerun and refuses conflicting input', async () => {
  const now = Date.parse('2026-09-27T00:00:00Z');
  const id = 'rehearsal-' + Date.now();
  const input = { version: 1, clubs: [{ id, membershipSchemaVersion: 1 }], accounts: [], identityMappings: [],
    sources: [{ collection: 'club_schedules', id, data: { feedSchemaVersion: 1, feedClubId: id,
      created_at: '2026-09-26T00:00:00Z', event_date: '2026-10-03T10:00:00+09:00', title: '검증 일정' } }] };
  assert.equal((await rehearseLocalBackfill(input, now)).matched, true);
  const app = initializeApp({ projectId: 'demo-moyoung' }, 'backfill-test');
  const db = getFirestore(app, 'migration-rehearsal');
  try {
    const feed = db.collection('clubs/' + id + '/feed');
    const first = (await feed.get()).docs[0];
    await first.ref.update({ 'stats.heartCount': 9 });
    assert.equal((await rehearseLocalBackfill(input, now)).matched, true);
    const second = await feed.get();
    assert.equal(second.size, 1); assert.equal(second.docs[0].id, first.id);
    assert.equal(second.docs[0].data().stats.heartCount, 9);
    const conflict = structuredClone(input);
    conflict.sources[0].data.title = '덮어쓰기';
    await assert.rejects(rehearseLocalBackfill(conflict, now), /differs/);
    assert.equal((await db.doc('club_schedules/' + id).get()).data().title, '검증 일정');
    const invalid = structuredClone(input); invalid.sources[0].data.feedClubId = 'missing';
    await assert.rejects(rehearseLocalBackfill(invalid, now), /Preview issues/);
  } finally { await db.terminate(); await deleteApp(app); }
});
