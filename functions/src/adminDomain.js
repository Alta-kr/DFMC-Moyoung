import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
const roles=new Set(['member','media_admin','head_admin','server_admin']);
const validId=value=>typeof value==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
export async function applyAdminDomain(db, actorUid, input) {
  if(!input || !['setRole','setManagers','deleteCell','reorganizeCells','publishNotice'].includes(input.action)) throw new HttpsError('invalid-argument','관리 작업을 확인해주세요.');
  return db.runTransaction(async tx=>{
    const actor=await tx.get(db.doc('users/'+actorUid));
    const role=actor.data()?.role;
    const full=['head_admin','server_admin'].includes(role);
    if(!full && !(role==='media_admin' && input.action==='publishNotice')) throw new HttpsError('permission-denied','관리자 권한이 필요합니다.');
    const audit=db.collection('_adminAudit').doc();
    if(input.action==='setRole') {
      if(role!=='server_admin') throw new HttpsError('permission-denied','서버 관리자 권한이 필요합니다.');
      if(!validId(input.uid) || !roles.has(input.role) || input.uid===actorUid) throw new HttpsError('invalid-argument','대상과 권한을 확인해주세요.');
      const ref=db.doc('users/'+input.uid),target=await tx.get(ref);
      if(!target.exists || target.data().role==='guest' || target.data().is_guest) throw new HttpsError('failed-precondition','일반 회원을 선택해주세요.');
      tx.update(ref,{role:input.role});
    } else if(input.action==='setManagers') {
      if(!validId(input.clubId) || !Array.isArray(input.uids) || input.uids.length>3 || input.uids.some(uid=>!validId(uid)) || new Set(input.uids).size!==input.uids.length) throw new HttpsError('invalid-argument','총무는 최대 3명입니다.');
      const ref=db.doc('clubs/'+input.clubId),club=await tx.get(ref);
      if(club.data()?.membershipSchemaVersion!==1) throw new HttpsError('failed-precondition','회원 연결 전환이 필요합니다.');
      const old=club.data().leaderUids??[],all=[...new Set([...old,...input.uids])];
      const members=await Promise.all(all.map(uid=>tx.get(db.doc('clubs/'+input.clubId+'/members/'+uid))));
      const users=await Promise.all(all.map(uid=>tx.get(db.doc('users/'+uid))));
      for(let i=0;i<all.length;i++) if(input.uids.includes(all[i]) && (members[i].data()?.status!=='active' || !roles.has(users[i].data()?.role) || users[i].data()?.is_guest)) throw new HttpsError('failed-precondition','활성 회원만 총무가 될 수 있습니다.');
      all.forEach((uid,i)=>{if(members[i].exists) tx.update(members[i].ref,{is_leader:input.uids.includes(uid)});});
      tx.update(ref,{leaderUids:[...input.uids].sort()});
    } else if(input.action==='deleteCell') {
      if(!validId(input.cellId)) throw new HttpsError('invalid-argument','셀을 확인해주세요.');
      const ref=db.doc('cells/'+input.cellId),cell=await tx.get(ref);
      if(!cell.exists || cell.data().name==='둔산제일교회') throw new HttpsError('failed-precondition','기본 셀은 삭제할 수 없습니다.');
      tx.delete(ref);
    } else if(input.action==='reorganizeCells') {
      if(!Array.isArray(input.names)||!input.names.length||input.names.length>400||input.names.some(name=>typeof name!=='string'||!name.trim()||name.length>80)) throw new HttpsError('invalid-argument','셀 목록을 확인해주세요.');
      const names=input.names.map(name=>name.trim());
      if(new Set(names).size!==names.length) throw new HttpsError('invalid-argument','중복 셀을 제거해주세요.');
      const old=await tx.get(db.collection('cells').limit(450));
      if(old.size+names.length>450) throw new HttpsError('failed-precondition','분할 셀 정리가 필요합니다.');
      const base=old.docs.find(cell=>cell.data().name==='둔산제일교회');
      old.docs.filter(cell=>cell.id!==base?.id).forEach(cell=>tx.delete(cell.ref));
      if(!base)tx.set(db.doc('cells/base'),{id:1,name:'둔산제일교회'});
      names.filter(name=>name!=='둔산제일교회').forEach((name,index)=>tx.set(db.collection('cells').doc(),{id:Date.now()+index,name}));
    } else {
      if(typeof input.title!=='string'||!input.title.trim()||input.title.length>200||typeof input.content!=='string'||input.content.length>20000) throw new HttpsError('invalid-argument','공지 내용을 확인해주세요.');
      const old=await tx.get(db.collection('notices').limit(450));
      if(old.size>=450) throw new HttpsError('failed-precondition','기존 공지 정리가 필요합니다.');
      old.docs.forEach(item=>tx.delete(item.ref));
      tx.set(db.doc('notices/current'),{id:Date.now(),title:input.title.trim(),content:input.content,author_uid:actorUid,author_name:actor.data().name??'',is_active:1,is_pinned:1,created_at:new Date().toISOString()});
    }
    tx.set(audit,{actorUid,action:input.action,at:Date.now()});
    return {changed:true};
  });
}
export const manageDomain=onCall({region:'asia-northeast3',maxInstances:5},async request=>{
  if(!request.auth || request.auth.token.email_verified!==true) throw new HttpsError('unauthenticated','인증된 계정이 필요합니다.');
  const actor=await getAuth().getUser(request.auth.uid);
  if(actor.disabled) throw new HttpsError('permission-denied','사용할 수 없는 계정입니다.');
  return applyAdminDomain(getFirestore(),request.auth.uid,request.data);
});

