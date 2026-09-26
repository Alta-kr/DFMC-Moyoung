import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { isDeepStrictEqual } from 'node:util';
import { previewMigration } from './migrationPreview.js';
import { normalizeSource, reconcileFeedSource } from './feedProjection.js';
import { refreshClubSummary, syncMemberSummary } from './homeProjection.js';

export async function rehearseLocalBackfill(input, now = Date.now()) {
  const preview = previewMigration(input, now);
  if (preview.issues.length) throw new Error('Preview issues must be resolved before rehearsal');
  if (input.clubs.length + input.sources.length > 300) throw new Error('Rehearsal is limited to 300 clubs + sources');
  // Fixed isolated emulator database. No project/host/database overrides or Auth mutations.
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  const app = initializeApp({ projectId: 'demo-moyoung' }, 'rehearsal-' + crypto.randomUUID());
  const db = getFirestore(app, 'migration-rehearsal');
  db.settings({ host: '127.0.0.1:8080', ssl: false });
  try {
    const clubRefs = input.clubs.map(club => db.doc('clubs/' + club.id));
    const sourceRefs = input.sources.map(source => db.doc(source.collection + '/' + source.id));
    // All conflicts are checked before the first seed write. Existing raw data is never overwritten.
    await db.runTransaction(async tx => {
      const refs = [...clubRefs, ...sourceRefs];
      const existing = refs.length ? await tx.getAll(...refs) : [];
      for (let i = 0; i < input.clubs.length; i++) {
        const data = existing[i].data();
        if (data && (data.membershipSchemaVersion !== 1 || data.rehearsalFixture !== true)) {
          throw new Error('Existing club is not owned by this rehearsal');
        }
      }
      for (let i = 0; i < input.sources.length; i++) {
        const data = existing[clubRefs.length + i].data();
        if (data && !isDeepStrictEqual(data, input.sources[i].data)) throw new Error('Existing source differs from input; use a fresh emulator');
      }
      for (let i = 0; i < clubRefs.length; i++) {
        if (!existing[i].exists) tx.create(clubRefs[i], {
          name: '로컬 검증 모영', membershipSchemaVersion: 1, leaderUids: [], rehearsalFixture: true,
        });
      }
      for (let i = 0; i < sourceRefs.length; i++) {
        if (!existing[clubRefs.length + i].exists) tx.create(sourceRefs[i], input.sources[i].data);
      }
    });
    const mismatches = [], paths = [];
    for (let i = 0; i < input.sources.length; i++) {
      const source = input.sources[i];
      const path = await reconcileFeedSource(db, source.collection, source.id, now);
      paths.push(path);
      const actual = path ? (await db.doc(path).get()).data() : null;
      const expected = normalizeSource(source.collection, source.id, source.data, now).card;
      if (!actual || Object.entries(expected).some(([key, value]) => !isDeepStrictEqual(actual[key], value))) {
        mismatches.push({ scope: 'feed', index: i });
      }
    }
    // Synthetic member tests the summary path without linking an exported person or granting Auth roles.
    const uid = 'rehearsal_member';
    await db.doc('users/' + uid).set({ role: 'member', name: '로컬 검증 회원' });
    for (const club of input.clubs) {
      await db.doc('clubs/' + club.id + '/members/' + uid).set({ role: 'member', status: 'active', is_leader: false });
      await refreshClubSummary(db, club.id, now);
      await syncMemberSummary(db, club.id, uid);
      const expectedCards = input.sources.map((source, index) => ({
        ...normalizeSource(source.collection, source.id, source.data, now), path: paths[index],
      })).filter(item => item.clubId === club.id && item.card.type === 'schedule'
        && item.card.status === 'active' && item.card.startsAt > now)
        .sort((a, b) => a.card.startsAt - b.card.startsAt || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
      const first = expectedCards[0]?.card;
      const expected = first ? { title: first.title, startsAt: first.startsAt } : null;
      const home = (await db.doc('users/' + uid + '/summaries/home').get()).data();
      if (!isDeepStrictEqual(home?.clubs.find(item => item.id === club.id)?.nextSchedule, expected)) {
        mismatches.push({ scope: 'home', clubId: club.id });
      }
      const actualFeed = await db.collection('clubs/' + club.id + '/feed').get();
      const expectedPaths = paths.filter(path => path?.startsWith('clubs/' + club.id + '/feed/')).sort();
      if (!isDeepStrictEqual(actualFeed.docs.map(doc => doc.ref.path).sort(), expectedPaths)) {
        mismatches.push({ scope: 'feed-count', clubId: club.id });
      }
    }
    return { project: 'demo-moyoung', database: 'migration-rehearsal', evaluatedAt: now,
      sources: input.sources.length, clubs: input.clubs.length, identityMappingsApplied: 0,
      matched: mismatches.length === 0, mismatches };
  } finally { await db.terminate(); await deleteApp(app); }
}
