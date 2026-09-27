import { normalizeSource } from './feedProjection.js';
import { parseMoyoungDate, scheduleTimes } from './dateTime.js';
const supported = new Set(['club_posts', 'club_schedules', 'club_polls']);
const segment = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
export function previewMigration(input, now) {
  if (!input || input.version !== 1 || !Number.isFinite(now)
      || !['clubs', 'sources', 'accounts', 'identityMappings'].every(key => Array.isArray(input[key]))
      || (input.legacyUsers !== undefined && !Array.isArray(input.legacyUsers))) {
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
      ['closesAtMs', 'closes_at_ms'], ['startsAtMs', 'starts_at_ms'], ['endsAtMs', 'ends_at_ms'],
      ['clubId', 'club_id'], ['isClosed', 'is_closed'], ['isPinned', 'is_pinned'], ['isExpired', 'is_expired']]) {
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
    const legacyClubId = data.club_id ?? data.clubId;
    if (legacyClubId !== undefined && String(legacyClubId) !== String(club.legacyId ?? club.id)) {
      issue('LEGACY_CLUB_MAPPING_MISMATCH', index, 'sources'); return;
    }
    if (card.card.type === 'schedule') {
      const times = scheduleTimes(data);
      if (times.startsAtMs === null || times.endsAtMs === null || times.endsAtMs <= times.startsAtMs) {
        issue('INVALID_SCHEDULE_TIME', index, 'sources'); return;
      }
      const text = data.eventDate ?? data.event_date;
      if (text !== undefined && (parseMoyoungDate(text) !== times.startsAtMs
          || (typeof text === 'string' && text.includes('~') && parseMoyoungDate(text, true) !== times.endsAtMs))) {
        issue('CONFLICTING_SCHEDULE_TIME', index, 'sources'); return;
      }
    }
    if (card.card.type === 'poll' && (data.endDate ?? data.end_date) !== undefined
        && parseMoyoungDate(data.endDate ?? data.end_date, true) !== card.card.closesAtMs) {
      issue('CONFLICTING_POLL_DEADLINE', index, 'sources'); return;
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
  const legacyAudit = input.legacyUsers === undefined ? undefined : auditLegacy(input, issue);
  return { version: 1, evaluatedAt: now, applySupported: false, readyForReview: issues.length === 0,
    totals: { sources: input.sources.length, eligibleCards: cards.length,
      identityMappings: input.identityMappings.length, evidenceReviewCandidates: identities.length, issues: issues.length },
    cards, identities, issues, ...(legacyAudit ? { legacyAudit } : {}) };
}

function auditLegacy(input, issue) {
  const ids = new Map(), keys = new Map(), managerCandidates = [];
  const stableId = value => /^(0|[1-9]\d*)$/.test(String(value)) && Number.isSafeInteger(Number(value))
    && Number(value) > 0 ? String(value) : null;
  const guest = user => user.role === 'guest' || user.is_guest === true || user.is_guest === 1;
  input.legacyUsers.forEach((user, index) => {
    if (!user || !stableId(user.id) || !segment(user.legacyId)
        || !['member', 'guest', 'head_admin', 'server_admin', 'media_admin'].includes(user.role)) {
      issue('INVALID_LEGACY_USER', index, 'legacyUsers'); return;
    }
    for (const [map, key] of [[ids, stableId(user.id)], [keys, user.legacyId]]) {
      const entries = map.get(key) ?? []; entries.push(index); map.set(key, entries);
    }
  });
  for (const map of [ids, keys]) for (const entries of map.values()) {
    if (entries.length > 1) entries.forEach(index => issue('DUPLICATE_LEGACY_ID', index, 'legacyUsers'));
  }
  input.identityMappings.forEach((mapping, index) => {
    const matches = keys.get(mapping?.legacyId) ?? [];
    if (matches.length !== 1) issue('LEGACY_ACCOUNT_NOT_UNIQUE', index, 'identityMappings');
    else if (guest(input.legacyUsers[matches[0]])) issue('GUEST_IDENTITY_POLICY_REQUIRED', index, 'identityMappings');
  });
  const mapped = new Set(input.identityMappings.map(mapping => mapping?.legacyId));
  input.legacyUsers.forEach((user, index) => {
    if (user && !guest(user) && !mapped.has(user.legacyId)) issue('UNMAPPED_LEGACY_USER', index, 'legacyUsers');
  });
  input.clubs.forEach((club, index) => {
    if (!club) return;
    const managers = club.manager_ids ?? club.managerIds;
    if (club.manager_ids !== undefined && club.managerIds !== undefined
        && JSON.stringify(club.manager_ids) !== JSON.stringify(club.managerIds)) {
      issue('CONFLICTING_MANAGER_ALIASES', index, 'clubs'); return;
    }
    if (managers === undefined) {
      if (typeof club.manager_names === 'string' && club.manager_names.trim()) issue('EXPLICIT_MANAGER_IDS_REQUIRED', index, 'clubs');
      return;
    }
    if (!Array.isArray(managers) || managers.length > 3 || managers.some(id => !stableId(id))
        || new Set(managers.map(String)).size !== managers.length) {
      issue('INVALID_MANAGER_IDS', index, 'clubs'); return;
    }
    const resolved = [];
    for (const id of managers) {
      const matches = ids.get(String(id)) ?? [];
      if (matches.length !== 1) { issue('MANAGER_ACCOUNT_NOT_UNIQUE', index, 'clubs'); return; }
      if (guest(input.legacyUsers[matches[0]])) { issue('GUEST_MANAGER_FORBIDDEN', index, 'clubs'); return; }
      resolved.push(matches[0]);
    }
    const labels = typeof club.manager_names === 'string' ? club.manager_names.split(',').filter(name => name.trim()) : [];
    if (labels.length && labels.length !== managers.length) {
      issue('MANAGER_LABEL_COUNT_MISMATCH', index, 'clubs'); return;
    }
    managerCandidates.push({ clubIndex: index, userIndexes: resolved });
  });
  return { users: input.legacyUsers.length, managerCandidates, completenessVerified: false };
}
