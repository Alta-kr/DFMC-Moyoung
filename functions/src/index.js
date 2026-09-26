import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

initializeApp();
const db = getFirestore();
const roles = new Set(['server_admin', 'head_admin']);
const idPattern = /^[a-zA-Z0-9_-]{1,128}$/;

// Membership only. Global role assignment, deletion and legacy-ID migration remain separate operations.
export const setClubMembership = onCall({ region: 'asia-northeast3', maxInstances: 5 }, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  if (request.auth.token.email_verified !== true) throw new HttpsError('permission-denied', '이메일 인증이 필요합니다.');
  const input = request.data;
  if (!input || typeof input !== 'object' || Array.isArray(input)
      || Object.keys(input).some(key => !['clubId', 'uid', 'status', 'isLeader'].includes(key))
      || typeof input.clubId !== 'string' || !idPattern.test(input.clubId)
      || typeof input.uid !== 'string' || !idPattern.test(input.uid)
      || !['active', 'revoked'].includes(input.status) || typeof input.isLeader !== 'boolean'
      || (input.status === 'revoked' && input.isLeader)) {
    throw new HttpsError('invalid-argument', '모임, 회원, 가입 상태와 총무 여부를 확인해주세요.');
  }
  const actorRef = db.doc('users/' + request.auth.uid);
  // Check before target lookup so unauthorized callers cannot enumerate Auth accounts.
  const actor = await actorRef.get();
  if (!roles.has(actor.data()?.role)) throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
  const caller = await getAuth().getUser(request.auth.uid);
  if (caller.disabled) throw new HttpsError('permission-denied', '사용할 수 없는 계정입니다.');
  const targetAccount = await getAuth().getUser(input.uid).catch(() => null);
  if (!targetAccount || targetAccount.disabled) throw new HttpsError('failed-precondition', '활성 회원 계정을 확인해주세요.');

  const clubRef = db.doc('clubs/' + input.clubId);
  const targetRef = db.doc('users/' + input.uid);
  const memberRef = clubRef.collection('members').doc(input.uid);
  const summaryRef = targetRef.collection('summaries').doc('home');
  const auditRef = clubRef.collection('membershipAudit').doc();
  return db.runTransaction(async tx => {
    const [actorDoc, clubDoc, targetDoc, memberDoc, summaryDoc] = await tx.getAll(actorRef, clubRef, targetRef, memberRef, summaryRef);
    // Re-read authority inside the transaction: demotion must take effect immediately.
    if (!roles.has(actorDoc.data()?.role)) throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
    const target = targetDoc.data();
    if (!target || !['member', 'server_admin', 'head_admin', 'media_admin'].includes(target.role)) {
      throw new HttpsError('failed-precondition', '게스트 또는 미등록 프로필은 변경할 수 없습니다.');
    }
    const club = clubDoc.data();
    if (!club || club.membershipSchemaVersion !== 1 || !Array.isArray(club.leaderUids)
        || !club.leaderUids.every(uid => typeof uid === 'string')
        || typeof club.name !== 'string') {
      throw new HttpsError('failed-precondition', '모임의 회원 전환 준비가 필요합니다.');
    }
    const leaders = new Set(club.leaderUids);
    leaders.delete(input.uid);
    if (input.isLeader && input.status === 'active') leaders.add(input.uid);
    if (leaders.size > 3) throw new HttpsError('failed-precondition', '총무는 모영당 최대 3명입니다.');
    const before = memberDoc.data();
    if (before?.status === input.status && before?.is_leader === input.isLeader
        && before?.role === 'member' && JSON.stringify([...leaders].sort()) === JSON.stringify([...new Set(club.leaderUids)].sort())) {
      return { changed: false };
    }
    const summary = summaryDoc.data();
    const clubs = (Array.isArray(summary?.clubs) ? summary.clubs : []).filter(item => item.id !== input.clubId);
    if (input.status === 'active') {
      // This field is a server-owned public summary, never a full schedule/member scan.
      const next = club.publicSummary?.nextSchedule;
      const nextSchedule = next && typeof next.title === 'string' && Number.isFinite(next.startsAt)
        ? { title: next.title, startsAt: next.startsAt } : null;
      clubs.push({ id: input.clubId, name: club.name, nextSchedule });
    }
    tx.set(memberRef, { role: 'member', status: input.status, is_leader: input.isLeader,
      updatedAt: FieldValue.serverTimestamp(), updatedBy: request.auth.uid });
    tx.update(clubRef, { leaderUids: [...leaders].sort() });
    tx.set(summaryRef, { notice: typeof summary?.notice === 'string' ? summary.notice : null, clubs, updatedAt: Date.now() });
    tx.set(auditRef, { actorUid: request.auth.uid, targetUid: input.uid,
      status: input.status, isLeader: input.isLeader, createdAt: FieldValue.serverTimestamp() });
    return { changed: true };
  });
});

export { projectActivity } from './participationTrigger.js';export { projectPost, projectSchedule, projectPoll, expireFeedItems } from './feedTriggers.js';

export { projectHomeSchedule, distributeHomeSummary, projectMemberHome, advanceHomeScheduleItems } from './homeTriggers.js';
