import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDocFromServer, setDoc, updateDoc,
  serverTimestamp, terminate, collection, getDocsFromServer } from 'firebase/firestore';
import { writeActivity, readMyActivity, postComment, deleteComment, readComments } from '../src/firebase/participation.ts';
import { putFixture, seedMemberFeed } from './previewFixtures.ts';

test('direct participation, own data, closed targets, comment retry and asynchronous counts', async () => {
  const app = initializeApp({ projectId: 'demo-moyoung', apiKey: 'demo-key' }, 'participation-test');
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const club = 'participation-' + Date.now();
  const denied = (promise: Promise<unknown>) => assert.rejects(promise, (e: any) => e.code === 'permission-denied');
  const feedRef = (id: string) => doc(db, 'clubs', club, 'feed', id);
  const actRef = (id: string, act: string) => doc(db, 'clubs', club, 'feed', id, 'activity', act);
  const waitStats = async (id: string, expected: Record<string, unknown>) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const stats = (await getDocFromServer(feedRef(id))).data()?.stats;
      if (Object.entries(expected).every(([key, value]) => JSON.stringify(stats?.[key]) === JSON.stringify(value))) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.fail('Projection did not converge: ' + JSON.stringify((await getDocFromServer(feedRef(id))).data()?.stats));
  };
  try {
    const { user } = await createUserWithEmailAndPassword(auth, club + '@example.test', 'Test-password-123');
    await setDoc(doc(db, 'users', user.uid), { uid: user.uid, name: '참여 회원', role: 'member', createdAt: serverTimestamp() });
    await seedMemberFeed(user.uid, club);
    assert.deepEqual(await readMyActivity(db, club, 'item-001', user.uid), { attending: false, vote: null, heart: false });
    await writeActivity(db, club, 'item-001', user.uid, 'attendance', true);
    await writeActivity(db, club, 'item-001', user.uid, 'attendance', true);
    await waitStats('item-001', { attendanceCount: 1 });
    await writeActivity(db, club, 'item-001', user.uid, 'attendance', false);
    await waitStats('item-001', { attendanceCount: 0 });
    await writeActivity(db, club, 'item-002', user.uid, 'vote', 'option-a');
    await waitStats('item-002', { voteCounts: { 'option-a': 1 } });
    await writeActivity(db, club, 'item-002', user.uid, 'vote', 'option-b');
    await waitStats('item-002', { voteCounts: { 'option-a': 0, 'option-b': 1 } });
    await denied(writeActivity(db, club, 'item-002', user.uid, 'vote', 'injected-option'));
    await denied(writeActivity(db, club, 'item-003', user.uid, 'attendance', true));
    await denied(writeActivity(db, club, 'item-001', 'other-user', 'attendance', true));
    await denied(setDoc(actRef('item-001', 'attendance_' + user.uid), { kind: 'attendance', uid: user.uid, value: true, updatedAt: serverTimestamp(), role: 'server_admin' }));
    await writeActivity(db, club, 'item-003', user.uid, 'heart', true);
    await writeActivity(db, club, 'item-003', user.uid, 'heart', true);
    await waitStats('item-003', { heartCount: 1 });
    await writeActivity(db, club, 'item-003', user.uid, 'heart', false);
    await waitStats('item-003', { heartCount: 0 });
    await postComment(db, club, 'item-003', user.uid, 'comment_retry', '같은 댓글');
    await postComment(db, club, 'item-003', user.uid, 'comment_retry', '같은 댓글');
    assert.equal((await readComments(db, club, 'item-003')).items.length, 1);
    await waitStats('item-003', { commentCount: 1 });
    await assert.rejects(postComment(db, club, 'item-003', user.uid, 'comment_retry', '다른 댓글'));
    await assert.rejects(postComment(db, club, 'item-003', user.uid, 'comment_empty', ' '));
    await denied(updateDoc(actRef('item-003', 'comment_retry'), { uid: 'other-user' }));
    await putFixture('clubs/' + club + '/feed/item-003/activity/comment_other', { kind: 'comment', uid: 'other-user', value: '다른 사람', updatedAt: 1 });
    await denied(deleteComment(db, club, 'item-003', 'comment_other'));
    await deleteComment(db, club, 'item-003', 'comment_retry');
    await deleteComment(db, club, 'item-003', 'comment_retry');
    await waitStats('item-003', { commentCount: 1 });
    // Each comment page remains bounded even with more than 10 comments.
    for (let n = 0; n < 11; n++) await postComment(db, club, 'item-000', user.uid, 'comment_page-' + n, '댓글 ' + n);
    const comments = await readComments(db, club, 'item-000');
    assert.equal(comments.items.length, 10);
    const last = await readComments(db, club, 'item-000', comments.cursor);
    assert.equal(last.items.length, 1);
    assert.equal(new Set([...comments.items, ...last.items].map(c => c.id)).size, 11);
    await denied(getDocsFromServer(collection(db, 'clubs', club, 'feed', 'item-000', 'activity')));
    await denied(updateDoc(feedRef('item-003'), { stats: { heartCount: 500 } }));
    // Stale cards cannot bypass a server deadline even when status is still active.
    await putFixture('clubs/' + club + '/feed/expired', { type: 'poll', status: 'active', closesAtMs: 1, optionIds: ['option-a'] });
    await denied(writeActivity(db, club, 'expired', user.uid, 'vote', 'option-a'));
    await putFixture('clubs/' + club + '/feed/closed', { type: 'schedule', status: 'closed', closesAtMs: 4102444800000 });
    await denied(writeActivity(db, club, 'closed', user.uid, 'attendance', true));
    await denied(writeActivity(db, club, 'missing-target', user.uid, 'heart', true));
    await putFixture('clubs/' + club + '/members/' + user.uid, { role: 'member', status: 'revoked' });
    await denied(writeActivity(db, club, 'item-003', user.uid, 'heart', true));
    await putFixture('clubs/' + club + '/members/' + user.uid, { role: 'guest', status: 'active' });
    await denied(postComment(db, club, 'item-003', user.uid, 'comment_guest', '게스트'));
    await signOut(auth);
    await denied(writeActivity(db, club, 'item-003', user.uid, 'heart', true));
  } finally { await terminate(db); await deleteApp(app); }
});
