import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { refreshClubSummary, syncMemberSummary, processHomeSummaryPage, advanceHomeSchedules } from '../src/homeProjection.js';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
async function until(read, accepts) {
  for (let i = 0; i < 200; i++) {
    const result = await read();
    if (accepts(result)) return result;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Home summary did not converge');
}
test('schedule source changes propagate to home; time, deletion, revocation and replay are safe', async () => {
  const app = initializeApp({ projectId: 'demo-moyoung' }, 'home-test');
  const db = getFirestore(app);
  const id = 'home-' + Date.now();
  const club = db.doc('clubs/' + id);
  const uid = id + '-member';
  const member = club.collection('members').doc(uid);
  const home = db.doc('users/' + uid + '/summaries/home');
  const source = db.doc('club_schedules/' + id);
  const next = db.doc('club_schedules/' + id + '-later');
  const now = Date.now();
  const raw = { feedSchemaVersion: 1, feedClubId: id, title: '가까운 일정',
    created_at: new Date(now).toISOString(), event_date: now + 3600000 };
  try {
    await club.set({ name: '홈 모영', membershipSchemaVersion: 1, leaderUids: [] });
    await db.doc('users/' + uid).set({ role: 'member' });
    await home.set({ notice: '기존 공지', clubs: [{ id: 'other', name: '다른 모영', nextSchedule: null }], updatedAt: 1 });
    await member.set({ status: 'active', role: 'member' });
    await source.set(raw);
    await next.set({ ...raw, title: '그다음 일정', event_date: now + 7200000 });
    const read = async () => (await home.get()).data();
    const current = value => value?.clubs.find(item => item.id === id)?.nextSchedule;
    const first = await until(read, value => current(value)?.title === raw.title);
    assert.equal(first.notice, '기존 공지');
    assert.equal(first.clubs[0].id, 'other');
    await source.update({ title: '바뀐 일정' });
    await until(read, value => current(value)?.title === '바뀐 일정');
    // Time alone advances the home card; attendance can remain open in the feed.
    await advanceHomeSchedules(db, now + 3600001);
    await until(read, value => current(value)?.title === '그다음 일정');
    await next.delete();
    await source.delete();
    await until(read, value => current(value) === null);
    await source.set(raw);
    await until(read, value => current(value)?.title === raw.title);
    await member.update({ status: 'revoked' });
    await Promise.all([syncMemberSummary(db, id, uid), processHomeSummaryPage(db, id, 2)]);
    await until(read, value => !value.clubs.some(item => item.id === id));
    await syncMemberSummary(db, id, uid); // Delayed fanout after revocation.
    assert.equal((await read()).clubs.some(item => item.id === id), false);
    await member.update({ status: 'active' });
    await until(read, value => current(value)?.title === raw.title);
    await db.doc('users/' + uid).update({ role: 'guest' });
    await syncMemberSummary(db, id, uid);
    assert.equal((await read()).clubs.some(item => item.id === id), false);
    const before = (await club.get()).data();
    assert.equal(await refreshClubSummary(db, id), false);
    assert.deepEqual((await club.get()).data(), before);
    await assert.rejects(processHomeSummaryPage(db, id, 101));
  } finally { await db.terminate(); await deleteApp(app); }
});
