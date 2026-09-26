import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Set emulator endpoints before Admin initialization; no production fallbacks.
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
const app = initializeApp({ projectId: 'demo-moyoung' }, 'membership-test');
const db = getFirestore(app);
const auth = getAuth(app);
async function makeUser(role = 'member', verified = true) {
  const email = 'membership-' + crypto.randomUUID() + '@example.test';
  const user = await auth.createUser({ email, password: 'Test-password-123', emailVerified: verified });
  await db.doc('users/' + user.uid).set({ uid: user.uid, name: '검증 회원', role });
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Test-password-123', returnSecureToken: true }),
  });
  const result = await response.json();
  assert.ok(result.idToken);
  return { uid: user.uid, token: result.idToken };
}
async function call(token, data) {
  const response = await fetch('http://127.0.0.1:5001/demo-moyoung/asia-northeast3/setClubMembership', {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify({ data }),
  });
  return response.json();
}
test('admin membership, idempotency, concurrent leader limit, audit and revocation', async () => {
  try {
    const admin = await makeUser('server_admin');
    const ordinary = await makeUser();
    const unverified = await makeUser('head_admin', false);
    const clubId = 'admin-' + Date.now();
    await db.doc('clubs/' + clubId).set({ name: '검증 모영', membershipSchemaVersion: 1, leaderUids: [] });
    const input = { clubId, uid: ordinary.uid, status: 'active', isLeader: false };
    assert.equal((await call(null, input)).error.status, 'UNAUTHENTICATED');
    assert.equal((await call(ordinary.token, input)).error.status, 'PERMISSION_DENIED');
    assert.equal((await call(unverified.token, input)).error.status, 'PERMISSION_DENIED');
    assert.equal((await call(admin.token, { ...input, role: 'server_admin' })).error.status, 'INVALID_ARGUMENT');
    assert.equal((await call(admin.token, { ...input, clubId: 'no-migration' })).error.status, 'FAILED_PRECONDITION');
    assert.equal((await call(admin.token, input)).result.changed, true);
    assert.equal((await call(admin.token, input)).result.changed, false);
    assert.equal((await db.doc('users/' + ordinary.uid + '/summaries/home').get()).data().clubs[0].id, clubId);
    assert.equal((await db.collection('clubs/' + clubId + '/membershipAudit').get()).size, 1);
    const candidates = await Promise.all(Array.from({ length: 4 }, () => makeUser()));
    const results = await Promise.all(candidates.map(user => call(admin.token, { clubId, uid: user.uid, status: 'active', isLeader: true })));
    assert.equal(results.filter(result => result.result?.changed).length, 3);
    assert.equal(results.filter(result => result.error?.status === 'FAILED_PRECONDITION').length, 1);
    assert.equal((await db.doc('clubs/' + clubId).get()).data().leaderUids.length, 3);
    assert.equal((await call(admin.token, { ...input, status: 'revoked' })).result.changed, true);
    assert.equal((await db.doc('users/' + ordinary.uid + '/summaries/home').get()).data().clubs.length, 0);
    const guest = await makeUser('guest');
    assert.equal((await call(admin.token, { ...input, uid: guest.uid })).error.status, 'FAILED_PRECONDITION');
    await db.doc('users/' + admin.uid).update({ role: 'member' });
    // Previously issued token must not preserve a removed administrator role.
    assert.equal((await call(admin.token, input)).error.status, 'PERMISSION_DENIED');
  } finally { await db.terminate(); await deleteApp(app); }
});
