import { FieldPath } from 'firebase-admin/firestore';
const roles = new Set(['member', 'server_admin', 'head_admin', 'media_admin']);
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function refreshClubSummary(db, clubId, now = Date.now()) {
  const clubRef = db.doc('clubs/' + clubId);
  const jobRef = db.doc('_homeSummaryJobs/' + clubId);
  return db.runTransaction(async tx => {
    const [clubDoc, jobDoc] = await tx.getAll(clubRef, jobRef);
    const club = clubDoc.data();
    if (club?.membershipSchemaVersion !== 1) return false;
    const upcoming = await tx.get(clubRef.collection('feed')
      .where('type', '==', 'schedule').where('status', '==', 'active')
      .where('startsAt', '>', now).orderBy('startsAt').orderBy(FieldPath.documentId()).limit(1));
    const first = upcoming.docs[0]?.data();
    const next = first ? { title: first.title, startsAt: first.startsAt } : null;
    if (equal(club.publicSummary?.nextSchedule, next)) return false;
    tx.update(clubRef, { 'publicSummary.nextSchedule': next });
    tx.set(jobRef, { revision: (jobDoc.data()?.revision ?? 0) + 1, cursor: null, pending: true });
    return true;
  });
}

export async function syncMemberSummary(db, clubId, uid) {
  return db.runTransaction(async tx => {
    const [clubDoc, memberDoc, userDoc, homeDoc] = await tx.getAll(
      db.doc('clubs/' + clubId), db.doc('clubs/' + clubId + '/members/' + uid),
      db.doc('users/' + uid), db.doc('users/' + uid + '/summaries/home'));
    const club = clubDoc.data(), member = memberDoc.data(), home = homeDoc.data();
    if (!userDoc.exists) return;
    const previous = Array.isArray(home?.clubs) ? home.clubs : [];
    const entry = previous.find(item => item.id === clubId);
    const allowed = club?.membershipSchemaVersion === 1 && typeof club.name === 'string'
      && member?.status === 'active' && roles.has(member.role) && roles.has(userDoc.data().role);
    const next = club?.publicSummary?.nextSchedule;
    const replacement = allowed ? { id: clubId, name: club.name,
      nextSchedule: next && typeof next.title === 'string' && Number.isFinite(next.startsAt)
        ? { title: next.title, startsAt: next.startsAt } : null } : null;
    if (equal(entry ?? null, replacement)) return;
    // Re-read authority in the same transaction. Delayed fanout cannot restore revoked membership.
    const clubs = replacement
      ? entry ? previous.map(item => item.id === clubId ? replacement : item) : [...previous, replacement]
      : previous.filter(item => item.id !== clubId);
    tx.set(db.doc('users/' + uid + '/summaries/home'), {
      notice: typeof home?.notice === 'string' ? home.notice : null, clubs, updatedAt: Date.now(),
    }, { merge: true });
  });
}

export async function processHomeSummaryPage(db, clubId, pageSize = 100) {
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new Error('Invalid page size');
  const jobRef = db.doc('_homeSummaryJobs/' + clubId);
  const job = (await jobRef.get()).data();
  if (!job?.pending) return 0;
  let query = db.collection('clubs/' + clubId + '/members').orderBy(FieldPath.documentId()).limit(pageSize);
  if (job.cursor) query = query.startAfter(job.cursor);
  const members = await query.get();
  // Bounded concurrency reduces contention on shared home documents.
  for (let offset = 0; offset < members.size; offset += 10) {
    await Promise.all(members.docs.slice(offset, offset + 10).map(member => syncMemberSummary(db, clubId, member.id)));
  }
  await db.runTransaction(async tx => {
    const current = (await tx.get(jobRef)).data();
    if (current?.revision !== job.revision || current?.cursor !== job.cursor || !current.pending) return;
    tx.update(jobRef, { pending: members.size === pageSize, cursor: members.docs.at(-1)?.id ?? job.cursor });
  });
  return members.size;
}

export async function advanceHomeSchedules(db, now = Date.now()) {
  const due = await db.collection('clubs').where('publicSummary.nextSchedule.startsAt', '<=', now)
    .where('publicSummary.nextSchedule.startsAt', '>=', 0)
    .orderBy('publicSummary.nextSchedule.startsAt').limit(100).get();
  for (const club of due.docs) await refreshClubSummary(db, club.id, now);
  // Recover jobs whose event delivery failed; checkpoints make repeated work safe.
  const jobs = await db.collection('_homeSummaryJobs').where('pending', '==', true).limit(100).get();
  for (const job of jobs.docs) await processHomeSummaryPage(db, job.id);
  return due.size;
}
