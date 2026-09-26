import FeedParticipation from '../components/FeedParticipation';
import { useEffect, useRef, useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { watchHomeSummary, readFeedPage, appendFeedPage, readError,
  type HomeSummary, type FeedItem, type FeedCursor } from '../firebase/feedReader';

export default function MemberHomePage({ db, uid }: { db: Firestore; uid: string }) {
  const [summary, setSummary] = useState<HomeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    return watchHomeSummary(db, uid, value => {
      setSummary(value); setLoading(false); setError('');
    }, e => {
      setSummary(null); setSelected(null); setError(readError(e)); setLoading(false);
    });
  }, [db, uid, revision]);
  if (selected) return <ClubFeed key={uid + ':' + selected} db={db} uid={uid} clubId={selected}
    title={summary?.clubs.find(club => club.id === selected)?.name || '모임'}
    onBack={() => setSelected(null)} />;
  return <section aria-label="모영 홈" style={{ marginTop: 24 }}>
    <h2>내 모영</h2>
    {loading && <p role="status">홈을 불러오고 있습니다.</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !summary && <p>등록된 모임 요약이 없습니다.</p>}
    {summary?.notice && <p>{summary.notice}</p>}
    {summary?.clubs.map(club => <article key={club.id} className="card" style={{ padding: 16, marginTop: 12 }}>
      <h3>{club.name}</h3>
      {club.nextSchedule && <p>{club.nextSchedule.title} · {new Date(club.nextSchedule.startsAt).toLocaleString('ko-KR')}</p>}
      <button className="btn btn-primary" onClick={() => setSelected(club.id)}>피드 보기</button>
    </article>)}
    {summary?.clubs.length === 0 && <p>가입한 모임이 없습니다.</p>}
    <button className="btn" disabled={loading} onClick={() => { setLoading(true); setError(''); setSummary(null); setSelected(null); setRevision(value => value + 1); }}>홈 새로고침</button>
  </section>;
}
function ClubFeed({ db, uid, clubId, title, onBack }: { db: Firestore; uid: string; clubId: string; title: string; onBack: () => void }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<FeedCursor | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);
  const locked = useRef(false);
  useEffect(() => {
    const lifecycle = generation;
    const version = ++lifecycle.current;
    locked.current = true;
    readFeedPage(db, clubId).then(page => {
      if (version !== lifecycle.current) return;
      setItems(page.items); setCursor(page.cursor); setHasMore(page.hasMore);
    }).catch(e => { if (version === lifecycle.current) setError(readError(e)); })
      .finally(() => {
        if (version === lifecycle.current) { locked.current = false; setLoading(false); }
      });
    return () => { lifecycle.current++; };
  }, [db, clubId, revision]);
  async function more() {
    if (locked.current || !hasMore || !cursor) return;
    locked.current = true; setLoading(true); setError('');
    const version = generation.current;
    try {
      const page = await readFeedPage(db, clubId, cursor);
      if (version !== generation.current) return;
      setItems(previous => appendFeedPage(previous, page.items));
      setCursor(page.cursor); setHasMore(page.hasMore);
    } catch (e) {
      if (version !== generation.current) return;
      setError(readError(e));
      if ((e as { code?: string }).code === 'permission-denied') {
        setItems([]); setCursor(null); setHasMore(false);
      }
    } finally {
      if (version === generation.current) { locked.current = false; setLoading(false); }
    }
  }
  const labels = { notice: '공지', schedule: '일정', poll: '투표', post: '글' };
  return <section aria-label="모임 피드" style={{ marginTop: 24 }}>
    <button className="btn" onClick={onBack}>홈으로</button>
    <h2>{title}</h2>
    <button className="btn" disabled={loading} onClick={() => { setLoading(true); setError(''); setItems([]); setCursor(null); setHasMore(true); setRevision(value => value + 1); }}>새로고침</button>
    {error && <p role="alert">{error}</p>}
    {items.map(item => <article key={item.id} className="card" style={{ padding: 16, marginTop: 12 }}>
      <small>{labels[item.type]}{item.status === 'closed' ? ' · 종료' : ''}</small>
      <h3>{item.title}</h3><p style={{ whiteSpace: 'pre-wrap' }}>{item.excerpt}</p>
      <FeedParticipation db={db} clubId={clubId} item={item} uid={uid} />
    </article>)}
    {loading && <p role="status">불러오는 중…</p>}
    {!loading && !error && !items.length && <p>아직 등록된 글이 없습니다.</p>}
    {cursor && hasMore && <button className="btn btn-primary" disabled={loading} onClick={() => void more()}>
      {error ? '다시 시도' : '10개 더 보기'}
    </button>}
    {!loading && !hasMore && items.length > 0 && <p>모든 글을 확인했습니다.</p>}
  </section>;
}
