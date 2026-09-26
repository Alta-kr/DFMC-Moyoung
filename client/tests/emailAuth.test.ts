import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, serverTimestamp, terminate } from 'firebase/firestore';
import { emailAuth, profileDb, registerEmail, loginEmail, logoutEmail, readProfile, ensureProfile, resetPassword, verifyEmail } from '../src/firebase/emailAuth.ts';

test('email account lifecycle, recovery, and profile Rules', async () => {
  const second = initializeApp({ projectId: 'demo-moyoung', apiKey: 'demo-key' }, 'second-test');
  const otherAuth = getAuth(second);
  connectAuthEmulator(otherAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const otherDb = getFirestore(second);
  connectFirestoreEmulator(otherDb, '127.0.0.1', 8080);
  const email = 'member-' + Date.now() + '@example.test';
  const password = 'Test-password-123';
  const denied = (promise: Promise<unknown>) => assert.rejects(promise, (error: any) => error.code === 'permission-denied');
  try {
    await denied(getDoc(doc(otherDb, 'users', 'someone')));
    const account = await registerEmail(email, password, '테스트 회원');
    assert.deepEqual(await readProfile(account), {
      uid: account.uid, name: '테스트 회원', role: 'member',
      createdAt: (await getDoc(doc(profileDb, 'users', account.uid))).data()!.createdAt,
    });
    await ensureProfile(account, '바뀌면 안 되는 이름');
    assert.equal((await readProfile(account))!.name, '테스트 회원');
    await verifyEmail();
    await resetPassword(email);
    await denied(updateDoc(doc(profileDb, 'users', account.uid), { role: 'server_admin' }));
    await denied(updateDoc(doc(profileDb, 'users', account.uid), { groupIds: ['admin-group'] }));
    const other = (await createUserWithEmailAndPassword(otherAuth, 'other-' + email, password)).user;
    await denied(getDoc(doc(otherDb, 'users', account.uid)));
    await denied(setDoc(doc(otherDb, 'users', other.uid), {
      uid: other.uid, name: '권한 상승', role: 'server_admin', createdAt: serverTimestamp(),
    }));
    await denied(setDoc(doc(otherDb, 'users', other.uid), {
      uid: other.uid, name: '추가 필드', role: 'member', groupIds: ['x'], createdAt: serverTimestamp(),
    }));
    await logoutEmail();
    assert.equal(emailAuth.currentUser, null);
    await assert.rejects(loginEmail(email, 'wrong-password'));
    await loginEmail(email, password);
    assert.equal(emailAuth.currentUser!.uid, account.uid);
    await logoutEmail();
    // Auth account exists but profile creation never completed.
    const recovery = (await createUserWithEmailAndPassword(emailAuth, 'recover-' + email, password)).user;
    assert.equal(await readProfile(recovery), null);
    await ensureProfile(recovery, '복구 회원');
    assert.equal((await readProfile(recovery))!.name, '복구 회원');
  } finally {
    await logoutEmail();
    await terminate(profileDb); await terminate(otherDb);
    await deleteApp(second); await deleteApp(emailAuth.app);
  }
});
