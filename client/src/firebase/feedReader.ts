import { collection, doc, documentId, getDocFromServer, getDocsFromServer,
  limit, onSnapshot, orderBy, query, startAfter, type Firestore, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';

export const FEED_PAGE_SIZE = 10;
export interface FeedItem {
  id: string;
  type: 'notice' | 'schedule' | 'poll' | 'post';
  title: string;
  excerpt: string;
  priority: 100 | 90 | 80 | 10;
  sortAt: number;
  status: 'active' | 'closed';
  sourceId: string;
  closesAtMs?: number;
  options?: { id: string; label: string }[];
  stats?: { attendanceCount: number; heartCount: number; commentCount: number; voteCounts: Record<string, number> };
}
export interface HomeSummary {
  notice: string | null;
  clubs: { id: string; name: string; nextSchedule: { title: string; startsAt: number } | null }[];
  updatedAt: number;
}
export interface FeedCursor { clubId: string; document: QueryDocumentSnapshot }
export interface FeedPage { items: FeedItem[]; cursor: FeedCursor | null; hasMore: boolean }

function segment(value: string) {
  if (!value || value.includes('/')) throw new Error('잘못된 모임 또는 사용자 정보입니다.');
  return value;
}
export async function readHomeSummary(db: Firestore, uid: string): Promise<HomeSummary | null> {
  // One document, no fallback to the legacy full-collection scan.
  const result = await getDocFromServer(doc(db, 'users', segment(uid), 'summaries', 'home'));
  return result.exists() ? result.data() as HomeSummary : null;
}
export async function readFeedPage(db: Firestore, clubId: string, cursor: FeedCursor | null = null): Promise<FeedPage> {
  segment(clubId);
  if (cursor && cursor.clubId !== clubId) throw new Error('다른 모임의 페이지를 이어서 조회할 수 없습니다.');
  const clauses: QueryConstraint[] = [orderBy('priority', 'desc'), orderBy('sortAt', 'desc'), orderBy(documentId(), 'asc')];
  if (cursor) clauses.push(startAfter(cursor.document));
  clauses.push(limit(FEED_PAGE_SIZE));
  // Server-only prevents serving revoked membership data from an offline persistent cache.
  const result = await getDocsFromServer(query(collection(db, 'clubs', clubId, 'feed'), ...clauses));
  return {
    items: result.docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.id } as FeedItem)),
    cursor: result.empty ? null : { clubId, document: result.docs[result.docs.length - 1] },
    // An exact multiple of 10 needs one final empty request, never an 11-item lookahead.
    hasMore: result.size === FEED_PAGE_SIZE,
  };
}
export function appendFeedPage(previous: FeedItem[], next: FeedItem[]) {
  // Preserve query order. A moved item can occur again on another page.
  const seen = new Set(previous.map(item => item.id));
  return [...previous, ...next.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  })];
}
export function readError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'permission-denied') return '이 모임을 볼 권한이 없습니다. 가입 상태를 확인해주세요.';
  if (code === 'unavailable') return '연결을 확인한 뒤 다시 시도해주세요.';
  if (code === 'failed-precondition') return '목록을 준비하고 있습니다. 잠시 후 다시 시도해주세요.';
  return '불러오지 못했습니다. 다시 시도해주세요.';
}

export function watchHomeSummary(db: Firestore, uid: string,
  onValue: (summary: HomeSummary | null) => void, onError: (error: unknown) => void) {
  return onSnapshot(doc(db, 'users', segment(uid), 'summaries', 'home'),
    { includeMetadataChanges: true }, snapshot => {
      // Never restore another session's offline cached summary.
      if (!snapshot.metadata.fromCache) onValue(snapshot.exists() ? snapshot.data() as HomeSummary : null);
    }, onError);
}