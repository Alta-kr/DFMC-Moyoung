import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, getDocFromServer, getDocsFromServer, query,
  limit, setDoc, updateDoc, serverTimestamp, terminate } from 'firebase/firestore';
import { readHomeSummary, readFeedPage, appendFeedPage } from '../src/firebase/feedReader.ts';
import { putFixture, deleteFixture, seedMemberFeed, sampleFeed } from './previewFixtures.ts';

test('summary, 10-item cursor pages, moved/deleted boundaries and membership enforcement', async () => {
  const app = initializeApp({ projectId: 'demo-moyoung', apiKey: 'demo-key' }, 'feed-test');
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  const denied = (promise: Promise<unknown>) => assert.rejects(promise, (e: any) => e.code === 'permission-denied');
  const club = 'test-' + Date.now();
  try {
    await denied(readFeedPage(db, club));
    const { user } = await createUserWithEmailAndPassword(auth, club + '@example.test', 'Test-password-123');
    await setDoc(doc(db, 'users', user.uid), { uid: user.uid, name: '테스트 회원', role: 'member', createdAt: serverTimestamp() });
    assert.equal(await readHomeSummary(db, user.uid), null);
    await denied(readFeedPage(db, club));
    await seedMemberFeed(user.uid, club);
    const home = await readHomeSummary(db, user.uid);
    assert.equal(home!.clubs.length, 1); assert.equal(home!.clubs[0].id, club);
    const first = await readFeedPage(db, club);
    const second = await readFeedPage(db, club, first.cursor);
    const third = await readFeedPage(db, club, second.cursor);
    assert.deepEqual([first.items.length, second.items.length, third.items.length], [10, 10, 3]);
    assert.deepEqual([...first.items, ...second.items, ...third.items].map(item => item.id), sampleFeed().map(item => item.id));
    assert.equal(third.hasMore, false);
    await assert.rejects(readFeedPage(db, 'different', first.cursor));
    await denied(getDocsFromServer(collection(db, 'clubs', club, 'feed')));
    await denied(getDocsFromServer(query(collection(db, 'clubs', club, 'feed'), limit(11))));
    await denied(updateDoc(doc(db, 'clubs', club, 'feed', 'item-000'), { priority: 10 }));
    await denied(updateDoc(doc(db, 'users', user.uid, 'summaries', 'home'), { notice: '조작' }));
    await denied(setDoc(doc(db, 'clubs', club, 'members', user.uid), { role: 'server_admin', status: 'active' }));
    await denied(readHomeSummary(db, 'someone-else'));
    await denied(getDocFromServer(doc(db, 'club_posts', 'legacy-source')));
    // Deleting a cursor document must not invalidate a snapshot's stored sort values.
    await deleteFixture('clubs/' + club + '/feed/item-009');
    assert.deepEqual((await readFeedPage(db, club, first.cursor)).items.map(x => x.id), second.items.map(x => x.id));
    // An already-rendered item moves below the cursor; deduplicate it, preserve cursor progress.
    const moved = sampleFeed()[0];
    await putFixture('clubs/' + club + '/feed/item-000', { ...moved, priority: 10, sortAt: 1790000000000 });
    const tail = await readFeedPage(db, club, second.cursor);
    const merged = appendFeedPage([...first.items, ...second.items], tail.items);
    assert.equal(merged.length, 23);
    assert.equal(new Set(merged.map(x => x.id)).size, 23);
    const emptyClub = club + '-empty';
    await seedMemberFeed(user.uid, emptyClub, 0);
    const empty = await readFeedPage(db, emptyClub);
    assert.deepEqual(empty, { items: [], cursor: null, hasMore: false });
    const exactClub = club + '-exact';
    await seedMemberFeed(user.uid, exactClub, 10);
    const exact = await readFeedPage(db, exactClub);
    assert.equal(exact.hasMore, true);
    assert.equal((await readFeedPage(db, exactClub, exact.cursor)).hasMore, false);
    await putFixture('clubs/' + club + '/members/' + user.uid, { role: 'guest', status: 'active' });
    await denied(readFeedPage(db, club));
    await putFixture('clubs/' + club + '/members/' + user.uid, { role: 'member', status: 'revoked' });
    await denied(readFeedPage(db, club, first.cursor));
    await putFixture('clubs/' + club + '/members/' + user.uid, { role: 'member', status: 'active' });
    await putFixture('users/' + user.uid, { uid: user.uid, name: '게스트', role: 'guest' });
    await denied(readFeedPage(db, club));
    await signOut(auth);
    await denied(readHomeSummary(db, user.uid));
  } finally { await terminate(db); await deleteApp(app); }
});
