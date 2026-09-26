import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { reconcileActivity } from '../src/activityProjection.js';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
test('projection is replay safe, concurrent safe and reads the newest state', async () => {
  const app = initializeApp({ projectId: 'demo-moyoung' }, 'projection-test');
  const db = getFirestore(app);
  const club = 'projection-' + Date.now();
  const feed = db.doc('clubs/' + club + '/feed/card');
  const source = feed.collection('activity').doc('heart_user');
  try {
    await feed.set({ title: '집계 테스트' });
    await source.set({ kind: 'heart', uid: 'user', value: true });
    await Promise.all(Array.from({ length: 4 }, () => reconcileActivity(db, club, 'card', 'heart_user')));
    assert.equal((await feed.get()).data().stats.heartCount, 1);
    await source.set({ kind: 'heart', uid: 'user', value: false });
    await reconcileActivity(db, club, 'card', 'heart_user');
    // Delayed callbacks from an older "true" event still read the current "false".
    await reconcileActivity(db, club, 'card', 'heart_user');
    assert.equal((await feed.get()).data().stats.heartCount, 0);
    const comment = feed.collection('activity').doc('comment_test');
    await comment.set({ kind: 'comment', uid: 'user', value: '댓글' });
    await reconcileActivity(db, club, 'card', 'comment_test');
    await comment.delete();
    await Promise.all([reconcileActivity(db, club, 'card', 'comment_test'), reconcileActivity(db, club, 'card', 'comment_test')]);
    assert.equal((await feed.get()).data().stats.commentCount, 0);
    await feed.delete();
    await reconcileActivity(db, club, 'card', 'heart_user');
    assert.equal((await feed.get()).exists, false);
  } finally { await db.terminate(); await deleteApp(app); }
});
