import { collection, doc, getDoc, getDocs, query, where, runTransaction, type Firestore, type DocumentReference } from 'firebase/firestore';
import { isClubManager, managerIds } from './identity.ts';
export async function setLegacyManagers(db: Firestore, clubId: string, actorKey: string, input: unknown, action?: string) {
  if (!Array.isArray(input) || input.some(id => !/^\d+$/.test(String(id)))) throw new Error('고유 회원 ID를 선택해주세요.');
  const requested = [...new Set(input.map(String))];
  if (requested.length > 3 || (action && !['appoint','dismiss'].includes(action))) throw new Error('총무는 최대 3명입니다.');
  const targets = await Promise.all(requested.map(id => getDocs(query(collection(db,'users'),where('id','==',Number(id))))));
  if (targets.some(result => result.size !== 1)) throw new Error('회원 ID를 확인해주세요.');
  const clubRef = doc(db,'clubs',clubId);
  return runTransaction(db, async tx => {
    const [club, actor, ...users] = await Promise.all([tx.get(clubRef),tx.get(doc(db,'users',actorKey)),...targets.map(result=>tx.get(result.docs[0].ref))]);
    if (!club.exists() || !actor.exists() || !isClubManager(club.data(),actor.data())) throw new Error('총무 관리 권한이 없습니다.');
    if (!action && !['server_admin','head_admin'].includes(actor.data().role)) throw new Error('관리자 권한이 필요합니다.');
    if (users.some(user=>!user.exists() || user.data()?.role==='guest' || user.data()?.is_guest)) throw new Error('게스트는 총무가 될 수 없습니다.');
    const previous=managerIds(club.data());
    const ids=action==='appoint'?[...new Set([...previous,...requested])]:action==='dismiss'?previous.filter(id=>!requested.includes(id)):requested;
    if(ids.length>3) throw new Error('총무는 최대 3명입니다.');
    // Display labels are never used to grant authority.
    const managerQueries=await Promise.all(ids.map(id=>getDocs(query(collection(db,'users'),where('id','==',Number(id))))));
    if(managerQueries.some(result=>result.size!==1)) throw new Error('기존 총무 ID를 확인해주세요.');
    const managers=await Promise.all(managerQueries.map(result=>tx.get(result.docs[0].ref)));
    if(managers.some(user=>!user.exists() || user.data()?.role==='guest' || user.data()?.is_guest)) throw new Error('게스트는 총무가 될 수 없습니다.');
    const names=managers.map(user=>String(user.data()?.name??'')).join(', ');
    tx.update(clubRef,{manager_ids:ids,manager_names:names});
    return {manager_ids:ids};
  });
}

// 총무 자율 위임: 현직 총무 min(2, 인원)명 동의 시 manager_ids 반영.
const HANDOVER='club_handover_votes';
const isGuest=(user:any)=>!user || user.role==='guest' || Boolean(user.is_guest);
async function userRefs(db: Firestore, ids: string[]) {
  const results=await Promise.all(ids.map(id=>getDocs(query(collection(db,'users'),where('id','==',Number(id))))));
  if(results.some(result=>result.size!==1)) throw new Error('회원 ID를 확인해주세요.');
  return new Map(ids.map((id,i)=>[id,results[i].docs[0].ref]));
}
function nextManagers(vote: any, current: string[]) {
  const target=String(vote.target_user_id ?? vote.targetUserId);
  const action=vote.action_type ?? vote.actionType;
  if(action==='appoint') return current.includes(target) || current.length>=3 ? null : [...current,target];
  return !current.includes(target) || current.length<=1 ? null : current.filter(id=>id!==target);
}
async function settleHandover(db: Firestore, clubId: string, actorKey: string, voteRef: DocumentReference, create?: { targetUserId: string; action: string }) {
  const clubRef=doc(db,'clubs',clubId);
  const pre=await getDoc(clubRef);
  const target=create?.targetUserId ?? String((await getDoc(voteRef)).data()?.target_user_id ?? '');
  if(!pre.exists() || !target) throw new Error('진행 중인 안건이 아닙니다.');
  const refs=await userRefs(db,[...new Set([...managerIds(pre.data()),target])]);
  return runTransaction(db, async tx => {
    const [club,actor,voteSnap,targetUser]=await Promise.all([tx.get(clubRef),tx.get(doc(db,'users',actorKey)),tx.get(voteRef),tx.get(refs.get(target)!)]);
    const current=managerIds(club.data());
    if(current.some(id=>!refs.has(id))) throw new Error('총무 명단이 변경되었습니다. 다시 시도해주세요.');
    const actorId=String(actor.data()?.id ?? '');
    if(!club.exists() || !actor.exists() || isGuest(actor.data()) || !current.includes(actorId)) throw new Error('현직 총무만 참여할 수 있습니다.');
    let vote: any;
    if(create) {
      if(!targetUser.exists() || isGuest(targetUser.data())) throw new Error('게스트는 총무가 될 수 없습니다.');
      vote={id:Number(voteRef.id.replace('handover_','')),club_id:Number(clubId),proposer_id:Number(actorId),proposer_name:String(actor.data()?.name??''),target_user_id:Number(target),target_user_name:String(targetUser.data()?.name??''),action_type:create.action,agreed_user_ids:[actorId],status:'pending',created_at:new Date().toISOString()};
      if(!nextManagers(vote,current)) throw new Error(create.action==='appoint'?'이미 총무이거나 총무가 3명입니다.':'현직 총무가 아니거나 마지막 총무입니다.');
    } else {
      vote=voteSnap.data();
      if(!voteSnap.exists() || vote.status!=='pending' || Number(vote.club_id ?? vote.clubId)!==Number(clubId)) throw new Error('진행 중인 안건이 아닙니다.');
      if((vote.agreed_user_ids||[]).map(String).includes(actorId)) throw new Error('이미 동의했습니다.');
      vote={...vote,agreed_user_ids:[...(vote.agreed_user_ids||[]).map(String),actorId]};
    }
    const agreed=vote.agreed_user_ids.filter((id:string)=>current.includes(id));
    if(agreed.length<Math.min(2,current.length)) {
      tx.set(voteRef,vote);
      return {message:create?'안건이 발의되었습니다. 다른 총무 1명이 동의하면 반영됩니다.':'동의했습니다.'};
    }
    const ids=nextManagers(vote,current);
    if(!ids || (vote.action_type==='appoint' && (!targetUser.exists() || isGuest(targetUser.data())))) {
      tx.set(voteRef,{...vote,status:'rejected'});
      return {message:'총무 명단이 바뀌어 안건이 종료되었습니다.'};
    }
    const users=await Promise.all(ids.map(id=>id===target?Promise.resolve(targetUser):tx.get(refs.get(id)!)));
    tx.update(clubRef,{manager_ids:ids,manager_names:users.map(user=>String(user.data()?.name??'')).join(', ')});
    tx.set(voteRef,{...vote,status:'completed'});
    return {message:'총무 명단이 반영되었습니다.'};
  });
}
export async function proposeHandover(db: Firestore, clubId: string, actorKey: string, targetUserId: unknown, action: unknown) {
  if(!/^\d+$/.test(String(targetUserId)) || !['appoint','dismiss'].includes(String(action))) throw new Error('안건 내용을 확인해주세요.');
  const pending=await getDocs(query(collection(db,HANDOVER),where('club_id','==',Number(clubId)),where('status','==','pending')));
  if(pending.docs.some(d=>String(d.data().target_user_id)===String(targetUserId) && d.data().action_type===action)) throw new Error('같은 안건이 이미 진행 중입니다.');
  return settleHandover(db,clubId,actorKey,doc(db,HANDOVER,'handover_'+Date.now()),{targetUserId:String(targetUserId),action:String(action)});
}
export function agreeHandover(db: Firestore, clubId: string, actorKey: string, voteId: string) {
  return settleHandover(db,clubId,actorKey,doc(db,HANDOVER,'handover_'+voteId));
}
export async function pendingHandovers(db: Firestore, clubId: number, user: any) {
  const snap=await getDocs(query(collection(db,HANDOVER),where('club_id','==',clubId),where('status','==','pending')));
  return snap.docs.map(d=>d.data()).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).map(v=>{
    const agreed=(v.agreed_user_ids||[]).map(String);
    return {...v,agreed_user_ids:agreed,has_agreed:agreed.includes(String(user?.id))};
  });
}

