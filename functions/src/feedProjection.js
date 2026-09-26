import { createHash } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';

const kinds = { club_posts: 'post', club_schedules: 'schedule', club_polls: 'poll' };
const yes = value => value === true || value === 1;
const alias = (data, camel, snake) => data[camel] ?? data[snake];
const hash = value => createHash('sha256').update(value).digest('hex');
function millis(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value?.toMillis) return value.toMillis();
  if (typeof value !== 'string') return null;
  // Date-only values are Korean local dates. Ambiguous local date-times are rejected.
  const explicit = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T00:00:00+09:00' : value;
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(explicit)) return null;
  const parsed = Date.parse(explicit);
  return Number.isFinite(parsed) ? parsed : null;
}
export function normalizeSource(collection, id, data, now = Date.now()) {
  const kind = kinds[collection];
  if (!kind) throw new Error('Unsupported feed source');
  // Explicit migration mapping; never infer a real club path from legacy numeric IDs.
  const clubId = alias(data ?? {}, 'feedClubId', 'feed_club_id');
  if (!data || alias(data, 'feedSchemaVersion', 'feed_schema_version') !== 1
      || typeof clubId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(clubId)) return null;
  const sortAt = millis(alias(data, 'createdAt', 'created_at'));
  if (sortAt === null) return null;
  const type = kind === 'post' && data.type === 'notice' && yes(alias(data, 'isPinned', 'is_pinned')) ? 'notice' : kind;
  const explicitDeadline = alias(data, 'closesAtMs', 'closes_at_ms');
  const eventAt = millis(alias(data, 'eventDate', 'event_date'));
  const closesAtMs = kind === 'post' ? null : explicitDeadline !== undefined ? millis(explicitDeadline)
    : kind === 'schedule' ? (eventAt === null ? null : eventAt + 86400000) : millis(alias(data, 'endDate', 'end_date'));
  const options = kind === 'poll' && Array.isArray(data.options) ? data.options.map(option => {
    if (typeof option === 'string') return { id: 'o_' + hash(option).slice(0, 32), label: option };
    return option && typeof option.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(option.id)
      && typeof option.label === 'string' ? { id: option.id, label: option.label } : null;
  }) : [];
  const validOptions = options.every(option => option && option.label.trim())
    && new Set(options.map(option => option?.id)).size === options.length;
  if (!validOptions) return null;
  const closed = yes(alias(data, 'isClosed', 'is_closed')) || yes(alias(data, 'isExpired', 'is_expired'))
    || (kind !== 'post' && (closesAtMs === null || closesAtMs <= now))
    || (kind === 'poll' && options.length < 2);
  return { clubId, card: {
    type, title: typeof data.title === 'string' ? data.title : type === 'notice' ? '모영 공지' : '모영 이야기',
    excerpt: String(data.description ?? data.content ?? '').slice(0, 500),
    priority: closed ? 10 : type === 'notice' ? 100 : kind === 'schedule' ? 90 : kind === 'poll' ? 80 : 10,
    sortAt, status: closed ? 'closed' : 'active', sourceCollection: collection, sourceId: id,
    projectionVersion: 1, startsAt: kind === 'schedule' ? eventAt : null, closesAtMs, options, optionIds: options.map(option => option.id),
  } };
}

export async function reconcileFeedSource(db, collection, id, now = Date.now()) {
  if (!Object.hasOwn(kinds, collection) || !id || id.includes('/')) throw new Error('Invalid feed source');
  const key = hash(collection + '/' + id);
  const registryRef = db.doc('_feedSources/' + key);
  const sourceRef = db.doc(collection + '/' + id);
  return db.runTransaction(async tx => {
    const [source, registry] = await tx.getAll(sourceRef, registryRef);
    const previous = registry.data();
    let next = normalizeSource(collection, id, source.data(), now);
    if (next) {
      const club = await tx.get(db.doc('clubs/' + next.clubId));
      if (club.data()?.membershipSchemaVersion !== 1) next = null;
    }
    const oldPath = previous?.path ?? null;
    const sameClub = next && oldPath?.startsWith('clubs/' + next.clubId + '/feed/');
    const generation = (previous?.generation ?? 0) + (next && !sameClub ? 1 : 0);
    const path = next ? 'clubs/' + next.clubId + '/feed/source_' + key + '_' + generation : null;
    const existing = path ? await tx.get(db.doc(path)) : null;
    if (oldPath && oldPath !== path) tx.delete(db.doc(oldPath));
    if (next) {
      // Merge retains server-owned activity counts when content, deadline or rank changes.
      const body = existing?.exists ? next.card : { ...next.card,
        stats: { attendanceCount: 0, heartCount: 0, commentCount: 0, voteCounts: {} } };
      tx.set(db.doc(path), body, { merge: true });
    }
    if (previous || next) tx.set(registryRef, { path, generation, collection, sourceId: id });
    return path;
  });
}

export async function expireFeed(db, now = Date.now()) {
  // Bounded invocations; closed documents leave this index and the next run drains the backlog.
  const due = await db.collectionGroup('feed').where('projectionVersion', '==', 1)
    .where('status', '==', 'active').where('closesAtMs', '<=', now)
    .where('closesAtMs', '>=', 0).orderBy('closesAtMs').orderBy(FieldPath.documentId()).limit(100).get();
  for (const card of due.docs) {
    const source = card.data();
    // A deadline may have been extended after the query. Re-read the source transactionally.
    await reconcileFeedSource(db, source.sourceCollection, source.sourceId, now);
  }
  return due.size;
}
