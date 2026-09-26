import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, terminate } from 'firebase/firestore';
import { watchHomeSummary, type HomeSummary } from '../src/firebase/feedReader.ts';
import { putFixture } from './previewFixtures.ts';
test('home subscription delivers server updates and stops after unsubscribe', async () => {
  const app = initializeApp({ projectId: 'demo-moyoung', apiKey: 'demo-key' }, 'home-subscription');
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8080);
  let stop = () => {};
  try {
    const { user } = await createUserWithEmailAndPassword(auth, 'home-' + Date.now() + '@example.test', 'Test-password-123');
    const received: (HomeSummary | null)[] = [];
    let failure: unknown;
    stop = watchHomeSummary(db, user.uid, value => received.push(value), error => { failure = error; });
    async function waitFor(accept: () => boolean) {
      for (let i = 0; i < 100; i++) {
        if (failure) throw failure;
        if (accept()) return;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error('Subscription timed out');
    }
    await waitFor(() => received.length > 0);
    assert.equal(received[0], null);
    await putFixture('users/' + user.uid + '/summaries/home', { notice: '변경', clubs: [], updatedAt: 1 });
    await waitFor(() => received.at(-1)?.notice === '변경');
    stop();
    const length = received.length;
    await putFixture('users/' + user.uid + '/summaries/home', { notice: '구독 종료', clubs: [], updatedAt: 2 });
    await new Promise(resolve => setTimeout(resolve, 200));
    assert.equal(received.length, length);
  } finally { stop(); await terminate(db); await deleteApp(app); }
});
