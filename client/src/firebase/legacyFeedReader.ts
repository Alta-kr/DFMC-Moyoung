import { collection, doc, documentId, getDoc, getDocs, limit, orderBy, query, startAfter, where, type Firestore } from 'firebase/firestore';
export async function readLegacyFeedPage(db: Firestore, clubId: number, cursorText: string | null) {
  let cursor: any = null;
  if (cursorText) {
    cursor = JSON.parse(cursorText);
    if (!Array.isArray(cursor) || cursor.length !== 3 || !Number.isFinite(cursor[0]) || !Number.isFinite(cursor[1]) || typeof cursor[2] !== 'string' || cursor[2].includes('/')) throw new Error('피드 위치를 확인해주세요.');
  }
  const snapshot = await getDocs(query(collection(db,'clubs',String(clubId),'feed'),orderBy('priority','desc'),orderBy('sortAt','desc'),orderBy(documentId(),'asc'),...(cursor?[startAfter(...cursor)]:[]),limit(10)));
  const sourceDocs = await Promise.all(snapshot.docs.map(card=>{
    const data=card.data();
    if(!['club_posts','club_polls','club_schedules'].includes(data.sourceCollection) || typeof data.sourceId!=='string' || data.sourceId.includes('/')) throw new Error('피드 원본을 확인해주세요.');
    return getDoc(doc(db,data.sourceCollection,data.sourceId));
  }));
  const safe = sourceDocs.filter(source=>source.exists() && Number(source.data()?.club_id ?? source.data()?.clubId)===clubId).map(source=>({ref:source.ref,data:()=>source.data()!}));
  const postsSnap={docs:safe.filter(source=>source.ref.parent.id==='club_posts')};
  const pollsSnap={docs:safe.filter(source=>source.ref.parent.id==='club_polls')};
  const schedSnap={docs:safe.filter(source=>source.ref.parent.id==='club_schedules')};
  const comments=await Promise.all([['post_id',postsSnap],['poll_id',pollsSnap],['schedule_id',schedSnap]].map(async ([field,snap]:any)=>{
    const ids=snap.docs.map((d:any)=>d.data().id);
    return ids.length?getDocs(query(collection(db,'club_comments'),where('club_id','==',clubId),where(field,'in',ids))):{docs:[]};
  }));
  const ids=safe.map(source=>source.data()?.id);
  const reactSnap=ids.length?await getDocs(query(collection(db,'club_reactions'),where('club_id','==',clubId),where('target_id','in',[...new Set(ids)]))):{docs:[]};
  const last=snapshot.docs.at(-1);
  return {postsSnap,pollsSnap,schedSnap,commSnap:{docs:comments.flatMap(s=>s.docs)},reactSnap,chatSnap:{docs:[]},
    nextCursor:snapshot.size===10&&last?JSON.stringify([last.data().priority,last.data().sortAt,last.id]):null};
}

