import { normalizeSource } from './feedProjection.js';
const supported = new Set(['club_posts', 'club_schedules', 'club_polls']);
const segment = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
export function previewMigration(input, now) {
  if (!input || input.version !== 1 || !Number.isFinite(now)
      || !['clubs', 'sources', 'accounts', 'identityMappings'].every(key => Array.isArray(input[key]))) {
    throw new Error('version 1 and clubs/sources/accounts/identityMappings arrays are required');
  }
  const issues = [], cards = [], identities = [];
  const issue = (code, index, scope) => issues.push({ code, index, scope });
  const clubs = new Map(), duplicateClubs = new Set();
  input.clubs.forEach((club, index) => {
    if (!club || !segment(club.id)) { issue('INVALID_CLUB', index, 'clubs'); return; }
    if (clubs.has(club.id)) { duplicateClubs.add(club.id); issue('DUPLICATE_CLUB', index, 'clubs'); }
    clubs.set(club.id, club);
  });
  const counts = new Map();
  for (const source of input.sources) {
    const key = source?.collection + '/' + source?.id;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  input.sources.forEach((source, index) => {
    if (!source || !supported.has(source.collection) || !segment(source.id)
        || !source.data || typeof source.data !== 'object' || Array.isArray(source.data)) {
      issue('INVALID_SOURCE', index, 'sources'); return;
    }
    if (counts.get(source.collection + '/' + source.id) > 1) {
      issue('DUPLICATE_SOURCE', index, 'sources'); return;
    }
    const data = source.data;
    for (const [a, b] of [['feedClubId', 'feed_club_id'], ['feedSchemaVersion', 'feed_schema_version'],
      ['createdAt', 'created_at'], ['eventDate', 'event_date'], ['endDate', 'end_date'],
      ['closesAtMs', 'closes_at_ms'], ['isClosed', 'is_closed'], ['isPinned', 'is_pinned'], ['isExpired', 'is_expired']]) {
      if (data[a] !== undefined && data[b] !== undefined && data[a] !== data[b]) {
        issue('CONFLICTING_ALIASES', index, 'sources'); return;
      }
    }
    const card = normalizeSource(source.collection, source.id, data, now);
    if (!card) { issue('UNMAPPED_OR_INVALID_SOURCE', index, 'sources'); return; }
    const club = clubs.get(card.clubId);
    if (!club || duplicateClubs.has(card.clubId) || club.membershipSchemaVersion !== 1) {
      issue('CLUB_NOT_READY', index, 'sources'); return;
    }
    if (card.card.type === 'schedule' && card.card.startsAt === null) {
      issue('INVALID_SCHEDULE_TIME', index, 'sources'); return;
    }
    if (['schedule', 'poll'].includes(card.card.type) && card.card.closesAtMs === null) {
      issue('INVALID_DEADLINE', index, 'sources'); return;
    }
    // Report metadata only, never copy private post bodies or account credentials.
    cards.push({ index, clubId: card.clubId, collection: source.collection, sourceId: source.id,
      type: card.card.type, status: card.card.status, priority: card.card.priority, sortAt: card.card.sortAt });
  });
  const accountIds = new Map(), legacyCounts = new Map(), uidCounts = new Map();
  for (const account of input.accounts) {
    if (account && segment(account.uid)) accountIds.set(account.uid, (accountIds.get(account.uid) ?? 0) + 1);
  }
  for (const mapping of input.identityMappings) {
    legacyCounts.set(mapping?.legacyId, (legacyCounts.get(mapping?.legacyId) ?? 0) + 1);
    uidCounts.set(mapping?.uid, (uidCounts.get(mapping?.uid) ?? 0) + 1);
  }
  input.identityMappings.forEach((mapping, index) => {
    if (!mapping || typeof mapping.legacyId !== 'string' || !mapping.legacyId.trim() || !segment(mapping.uid)) {
      issue('INVALID_IDENTITY_MAPPING', index, 'identityMappings'); return;
    }
    if (legacyCounts.get(mapping.legacyId) !== 1 || uidCounts.get(mapping.uid) !== 1) {
      issue('IDENTITY_COLLISION', index, 'identityMappings'); return;
    }
    if (accountIds.get(mapping.uid) !== 1) { issue('ACCOUNT_NOT_UNIQUE', index, 'identityMappings'); return; }
    if (typeof mapping.verificationRef !== 'string' || !mapping.verificationRef.trim()) {
      issue('OWNERSHIP_EVIDENCE_REQUIRED', index, 'identityMappings'); return;
    }
    identities.push({ index, status: 'requires-manual-evidence-review' });
  });
  return { version: 1, evaluatedAt: now, applySupported: false,
    totals: { sources: input.sources.length, eligibleCards: cards.length,
      identityMappings: input.identityMappings.length, evidenceReviewCandidates: identities.length, issues: issues.length },
    cards, identities, issues };
}
