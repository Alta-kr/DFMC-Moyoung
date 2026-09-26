import { useEffect, useRef, useState } from 'react';
import { doc, onSnapshot, type Firestore } from 'firebase/firestore';
import type { FeedItem } from '../firebase/feedReader';
import { readMyActivity, writeActivity, readComments, postComment, deleteComment, participationError,
  type MyActivity, type CommentItem, type CommentCursor, type ActivityKind } from '../firebase/participation';
import { createOptimisticAction } from '../firebase/optimisticAction';

export default function FeedParticipation({ db, clubId, item, uid }: { db: Firestore; clubId: string; item: FeedItem; uid: string }) {
  const [open, setOpen] = useState(false);
  return <div style={{ marginTop: 12 }}>
    <button className="btn" aria-expanded={open} onClick={() => setOpen(value => !value)}>{open ? '접기' : '참여·댓글'}</button>
    {open && <ParticipationPanel key={uid + ':' + clubId + ':' + item.id} db={db} clubId={clubId} item={item} uid={uid} />}
  </div>;
}
function ParticipationPanel({ db, clubId, item, uid }: { db: Firestore; clubId: string; item: FeedItem; uid: string }) {
  const [mine, setMine] = useState<MyActivity>({ attending: false, vote: null, heart: false });
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [cursor, setCursor] = useState<CommentCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [current, setCurrent] = useState(item);
  const [now, setNow] = useState(Date.now);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error, setError] = useState('');
  const [text, setText] = useState('');
  const [revision, setRevision] = useState(0);
  const action = useRef(createOptimisticAction());
  const draft = useRef<{ id: string; text: string } | null>(null);
  const generation = useRef(0);
  const commentsLock = useRef(false);

  useEffect(() => {
    const lifecycle = generation;
    const version = ++lifecycle.current;
    const unsubscribe = onSnapshot(doc(db, 'clubs', clubId, 'feed', item.id), snapshot => {
      if (version !== lifecycle.current || snapshot.metadata.fromCache) return;
      if (!snapshot.exists()) { setLoading(true); setError('삭제된 글입니다.'); return; }
      setCurrent({ ...snapshot.data(), id: snapshot.id } as FeedItem);
    }, error => {
      if (version !== lifecycle.current) return;
      setError(participationError(error)); setLoading(true); setComments([]);
    });
    Promise.all([readMyActivity(db, clubId, item.id, uid), readComments(db, clubId, item.id)])
      .then(([value, page]) => {
        if (version !== lifecycle.current) return;
        setMine(value); setComments(page.items); setCursor(page.cursor); setHasMore(page.hasMore); setLoading(false);
      }).catch(error => { if (version === lifecycle.current) setError(participationError(error)); });
    return () => { lifecycle.current++; unsubscribe(); };
  }, [db, clubId, item.id, uid, revision]);

  async function mutate(apply: () => void, persist: () => Promise<unknown>, rollback: () => void, success?: () => void) {
    const version = generation.current;
    const active = (callback: () => void) => { if (version === generation.current) callback(); };
    try {
      const changed = await action.current(() => { setBusy(true); setError(''); apply(); }, persist, () => active(rollback));
      if (changed) active(() => { success?.(); setBusy(false); });
    } catch (error) { active(() => { setError(participationError(error)); setBusy(false); }); }
  }
  function toggle(kind: ActivityKind, value: boolean | string) {
    const before = mine;
    const next = { ...mine, [kind === 'attendance' ? 'attending' : kind]: value } as MyActivity;
    void mutate(() => setMine(next), () => writeActivity(db, clubId, item.id, uid, kind, value), () => setMine(before));
  }
  async function moreComments() {
    if (!cursor || commentsLock.current || busy) return;
    commentsLock.current = true; setLoadingComments(true); setError('');
    const version = generation.current;
    try {
      const page = await readComments(db, clubId, item.id, cursor);
      if (version !== generation.current) return;
      setComments(previous => [...previous, ...page.items.filter(value => !previous.some(existing => existing.id === value.id))]);
      setCursor(page.cursor); setHasMore(page.hasMore);
    } catch (error) { if (version === generation.current) setError(participationError(error)); }
    finally { commentsLock.current = false; if (version === generation.current) setLoadingComments(false); }
  }
  useEffect(() => {
    if (!current.closesAtMs || current.closesAtMs <= now) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(current.closesAtMs - now + 20, 2147483647));
    return () => clearTimeout(timer);
  }, [current.closesAtMs, now]);
  const closed = current.status !== 'active' || !current.closesAtMs || now >= current.closesAtMs;
  const stats = current.stats;
  return <section aria-label="참여와 댓글">
    {loading && !error && <p role="status">참여 정보를 확인하고 있습니다.</p>}
    {error && <p role="alert">{error}</p>}
    {loading && error && <button className="btn" onClick={() => { setError(''); setRevision(value => value + 1); }}>다시 불러오기</button>}
    <fieldset disabled={loading || busy} style={{ border: 0, padding: 0 }}>
      {current.type === 'schedule' && <button className="btn" disabled={closed} aria-pressed={mine.attending}
        onClick={() => toggle('attendance', !mine.attending)}>{mine.attending ? '참석 취소' : '참석하기'} · {stats?.attendanceCount ?? 0}명</button>}
      {current.type === 'poll' && <div role="group" aria-label="투표 항목">
        {(current.options || []).map(option => <button key={option.id} className="btn" disabled={closed}
          aria-pressed={mine.vote === option.id} onClick={() => toggle('vote', option.id)}>
          {mine.vote === option.id ? '선택됨 · ' : ''}{option.label} ({stats?.voteCounts?.[option.id] ?? 0})
        </button>)}
      </div>}
      <button className="btn" aria-pressed={mine.heart} onClick={() => toggle('heart', !mine.heart)}>
        {mine.heart ? '♥ 하트 취소' : '♡ 하트'} · {stats?.heartCount ?? 0}
      </button>
      <p>댓글 {stats?.commentCount ?? 0}</p>
      {comments.map(comment => <div key={comment.id} style={{ margin: '10px 0', whiteSpace: 'pre-wrap' }}>
        <span>{comment.value}{comment.pending ? ' (저장 중…)' : ''}</span>
        {comment.uid === uid && !comment.pending && <button className="btn" disabled={loadingComments} onClick={() => {
          const before = comments;
          void mutate(() => setComments(values => values.filter(value => value.id !== comment.id)),
            () => deleteComment(db, clubId, item.id, comment.id), () => setComments(before));
        }}>삭제</button>}
      </div>)}
      {hasMore && <button className="btn" disabled={loadingComments} onClick={() => void moreComments()}>
        {loadingComments ? '불러오는 중…' : '댓글 10개 더 보기'}
      </button>}
      <form onSubmit={event => {
        event.preventDefault();
        const value = text.trim();
        if (!value || loadingComments) return;
        if (!draft.current || draft.current.text !== value) draft.current = { id: 'comment_' + crypto.randomUUID(), text: value };
        const pending: CommentItem = { id: draft.current.id, uid, value, pending: true };
        const before = comments;
        void mutate(() => setComments(values => [pending, ...values.filter(existing => existing.id !== pending.id)]),
          () => postComment(db, clubId, item.id, uid, pending.id, value), () => setComments(before),
          () => { setComments(values => values.map(existing => existing.id === pending.id ? { ...existing, pending: false } : existing)); setText(''); draft.current = null; });
      }}>
        <label className="form-label" htmlFor={'comment-' + item.id}>댓글 남기기</label>
        <textarea id={'comment-' + item.id} className="form-input" required maxLength={2000} value={text} onChange={event => setText(event.target.value)} />
        <button className="btn btn-primary" disabled={loadingComments || !text.trim()}>등록</button>
      </form>
    </fieldset>
    {busy && <p role="status">저장 중입니다.</p>}
    {(current.type === 'schedule' || current.type === 'poll') && closed && <p>마감된 참여입니다.</p>}
  </section>;
}
