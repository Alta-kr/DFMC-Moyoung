import { collection, doc, getDocFromServer, getDocsFromServer, setDoc,
  runTransaction, serverTimestamp, query, where, orderBy, documentId, limit, startAfter,
  type Firestore, type QueryDocumentSnapshot, type QueryConstraint } from 'firebase/firestore';

export type ActivityKind = 'attendance' | 'vote' | 'heart';
export interface CommentItem { id: string; uid: string; value: string; pending?: boolean }
export interface MyActivity { attending: boolean; vote: string | null; heart: boolean }
function path(clubId: string, itemId: string) {
  for (const id of [clubId, itemId]) if (!id || id.includes('/')) throw new Error('잘못된 대상입니다.');
  return ['clubs', clubId, 'feed', itemId, 'activity'] as const;
}
function owner(uid: string) {
  if (!uid || uid.includes('/')) throw new Error('로그인을 확인해주세요.');
  return uid;
}
export async function readMyActivity(db: Firestore, clubId: string, itemId: string, uid: string): Promise<MyActivity> {
  owner(uid);
  const [attendance, vote, heart] = await Promise.all(
    (['attendance', 'vote', 'heart'] as const).map(kind =>
      getDocFromServer(doc(db, ...path(clubId, itemId), kind + '_' + uid))));
  return { attending: attendance.data()?.value === true, vote: vote.data()?.value ?? null, heart: heart.data()?.value === true };
}
// Set the desired state instead of toggle/increment: retries cannot duplicate participation.
export async function writeActivity(db: Firestore, clubId: string, itemId: string, uid: string, kind: ActivityKind, value: boolean | string) {
  await setDoc(doc(db, ...path(clubId, itemId), kind + '_' + owner(uid)),
    { kind, uid, value, updatedAt: serverTimestamp() });
}
export async function postComment(db: Firestore, clubId: string, itemId: string, uid: string, id: string, text: string) {
  owner(uid);
  if (!/^comment_[a-zA-Z0-9-]{1,100}$/.test(id)) throw new Error('댓글 식별자를 확인해주세요.');
  const value = text.trim();
  if (!value || value.length > 2000) throw new Error('댓글은 1~2,000자로 입력해주세요.');
  const ref = doc(db, ...path(clubId, itemId), id);
  // Same operation ID is retained across retries; an acknowledged-but-lost response is safe.
  await runTransaction(db, async tx => {
    const existing = await tx.get(ref);
    if (existing.exists()) {
      if (existing.data().uid === uid && existing.data().kind === 'comment' && existing.data().value === value) return;
      throw new Error('댓글을 다시 확인해주세요.');
    }
    tx.set(ref, { kind: 'comment', uid, value, updatedAt: serverTimestamp() });
  });
}
export async function deleteComment(db: Firestore, clubId: string, itemId: string, id: string) {
  const ref = doc(db, ...path(clubId, itemId), id);
  await runTransaction(db, async tx => { if ((await tx.get(ref)).exists()) tx.delete(ref); });
}

export interface CommentCursor { clubId: string; itemId: string; document: QueryDocumentSnapshot }
export async function readComments(db: Firestore, clubId: string, itemId: string, cursor: CommentCursor | null = null) {
  if (cursor && (cursor.clubId !== clubId || cursor.itemId !== itemId)) throw new Error('댓글 조회 대상을 확인해주세요.');
  const constraints: QueryConstraint[] = [where('kind', '==', 'comment'), orderBy('updatedAt', 'desc'), orderBy(documentId(), 'asc')];
  if (cursor) constraints.push(startAfter(cursor.document));
  constraints.push(limit(10));
  const result = await getDocsFromServer(query(collection(db, ...path(clubId, itemId)), ...constraints));
  return {
    items: result.docs.map(snapshot => ({ id: snapshot.id, uid: snapshot.data().uid, value: snapshot.data().value } as CommentItem)),
    cursor: result.empty ? null : { clubId, itemId, document: result.docs[result.size - 1] },
    hasMore: result.size === 10,
  };
}
export function participationError(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === 'permission-denied') return '참여 권한 또는 마감 상태를 확인해주세요. 변경은 반영되지 않았습니다.';
  if (code === 'unavailable') return '연결되지 않았습니다. 다시 시도해주세요.';
  return error instanceof Error && !code ? error.message : '저장하지 못했습니다. 다시 시도해주세요.';
}
