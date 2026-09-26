import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { normalizeSource, reconcileFeedSource, expireFeed } from '../src/feedProjection.js';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const base = { feedSchemaVersion: 1, feedClubId: 'club_test', created_at: '2026-09-01T00:00:00Z' };

test('source mapping keeps legacy pinning separate and uses stable options and deadlines', () => {
  assert.equal(normalizeSource('club_posts', 'a', { ...base, is_pinned: 1 }).card.priority, 10);
  assert.equal(normalizeSource('club_posts', 'a', { ...base, type: 'notice', is_pinned: 1 }).card.priority, 100);
  assert.equal(normalizeSource('club_posts', 'a', { club_id: 1, created_at: base.created_at }), null);
  assert.equal(normalizeSource('club_posts', 'a', { ...base, created_at: 'bad' }), null);
  const raw = { ...base, options: ['토요일', '일요일'], end_date: '2099-01-01' };
  const first = normalizeSource('club_polls', 'p', raw, 1).card;
  const reordered = normalizeSource('club_polls', 'p', { ...raw, options: [...raw.options].reverse() }, 1).card;
  assert.equal(first.options[0].id, reordered.options[1].id);
  assert.equal(first.priority, 80);
  assert.equal(normalizeSource('club_polls', 'p', raw, first.closesAtMs).card.priority, 10);
  assert.equal(normalizeSource('club_polls', 'p', { ...raw, options: ['같음', '같음'] }), null);
  assert.equal(normalizeSource('club_polls', 'p', { ...raw, end_date: '' }).card.status, 'closed');
  const schedule = normalizeSource('club_schedules', 's', { ...base, event_date: '2099-01-01' }, 1).card;
  assert.equal(schedule.closesAtMs, Date.parse('2099-01-02T00:00:00+09:00'));
  assert.equal(normalizeSource('club_schedules', 's', { ...base, event_date: '2099-01-01T12:00:00' }, 1).card.status, 'closed');
});

async function until(read, accepts) {
  for (let i = 0; i < 100; i++) {
    const value = await read();
    if (accepts(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Projection did not converge');
}
test('source triggers, replay, edits, expiry, club moves and recreation preserve isolation', async () => {
  const app = initializeApp({ projectId: 'demo-moyoung' }, 'feed-source-test');
  const db = getFirestore(app);
  const suffix = Date.now().toString();
  const clubId = 'feed-source-' + suffix;
  const otherClub = clubId + '-other';
  const sourceId = 'source-' + suffix;
  const ref = db.doc('club_polls/' + sourceId);
  const raw = { ...base, feedClubId: clubId, title: '원본 투표', options: ['토요일', '일요일'], closesAtMs: Date.now() + 600000 };
  try {
    await db.doc('clubs/' + clubId).set({ membershipSchemaVersion: 1 });
    await db.doc('clubs/' + otherClub).set({ membershipSchemaVersion: 1 });
    await ref.set(raw);
    const cards = db.collection('clubs/' + clubId + '/feed');
    const projected = await until(() => cards.get(), result => result.size === 1);
    const path = projected.docs[0].ref.path;
    const feed = db.doc(path);
    assert.equal(projected.docs[0].data().priority, 80);
    await feed.update({ 'stats.heartCount': 7 });
    await ref.update({ title: '수정된 투표' });
    await Promise.all(Array.from({ length: 3 }, () => reconcileFeedSource(db, 'club_polls', sourceId)));
    assert.equal((await feed.get()).data().title, '수정된 투표');
    assert.equal((await feed.get()).data().stats.heartCount, 7);
    // Simulate an old due card while the source has an extended deadline.
    await feed.update({ closesAtMs: Date.now() - 1 });
    await expireFeed(db);
    assert.equal((await feed.get()).data().status, 'active');
    await ref.update({ closesAtMs: Date.now() - 1 });
    await reconcileFeedSource(db, 'club_polls', sourceId);
    await feed.update({ status: 'active', priority: 80 }); // Missed scheduled transition.
    await expireFeed(db);
    assert.equal((await feed.get()).data().priority, 10);
    assert.equal((await feed.get()).data().stats.heartCount, 7);
    await ref.update({ feedClubId: otherClub });
    const movedPath = await reconcileFeedSource(db, 'club_polls', sourceId);
    assert.equal((await feed.get()).exists, false);
    assert.equal((await db.doc(movedPath).get()).data().stats.heartCount, 0);
    await ref.delete();
    await reconcileFeedSource(db, 'club_polls', sourceId);
    assert.equal((await db.doc(movedPath).get()).exists, false);
    await ref.set(raw);
    const newPath = await reconcileFeedSource(db, 'club_polls', sourceId);
    assert.notEqual(newPath, path);
    assert.equal((await db.doc(newPath).get()).data().stats.heartCount, 0);
    // A late deletion callback always reads the newest source, so cannot erase the new card.
    assert.equal(await reconcileFeedSource(db, 'club_polls', sourceId), newPath);
    await ref.update({ feedSchemaVersion: 0 });
    await reconcileFeedSource(db, 'club_polls', sourceId);
    assert.equal((await db.doc(newPath).get()).exists, false);
  } finally { await db.terminate(); await deleteApp(app); }
});
