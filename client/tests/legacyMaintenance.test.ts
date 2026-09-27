import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,terminate} from 'firebase/firestore';
import {saveLegacyParticipation} from '../src/firebase/legacyParticipation.ts';
import {setLegacyManagers} from '../src/firebase/legacyManagers.ts';
import {samePerson} from '../src/firebase/identity.ts';
import {parseMoyoungDate,scheduleTimes} from '../../functions/src/dateTime.js';
import {readLegacyFeedPage} from '../src/firebase/legacyFeedReader.ts';
test('Korea dates and duplicate names use IDs',()=>{
 assert.equal(parseMoyoungDate('2026.9.27 14:00 ~ 16:00'),Date.parse('2026-09-27T14:00:00+09:00'));
 assert.equal(scheduleTimes({event_date:'2026-09-27 14:00 ~ 16:00'}).endsAtMs,Date.parse('2026-09-27T16:00:00+09:00'));
 assert.equal(parseMoyoungDate('2026-02-30'),null);
 assert.equal(parseMoyoungDate('2026-09-27',true),Date.parse('2026-09-27T23:59:59.999+09:00'));
 assert.equal(samePerson({user_name:'동명이인',user_id:1},{name:'동명이인',id:2}),false);
});
test('concurrent participation, idempotent retry, manager cap, guest denial and actual cursor pages',async()=>{
 const app=initializeApp({projectId:'demo-moyoung-ui'},'legacy-'+Date.now());
 const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8082);
 const base=Date.now(),club=String(base),names=[0,1,2,3].map(i=>'legacy-'+base+'-'+i);
 try{
  await Promise.all(names.map((username,i)=>setDoc(doc(db,'users',username),{username,id:base+i,name:'동명이인',role:i===3?'guest':'member'})));
  await setDoc(doc(db,'users','admin-'+base),{id:base+10,role:'head_admin',name:'관리자'});
  await setDoc(doc(db,'clubs',club),{name:'검증',manager_ids:[]});
  const common={club_id:base,event_date:'2099-01-01',end_date:'2099-01-01',options:['A','B'],attendees:[],votes:[]};
  await setDoc(doc(db,'club_schedules','sched_'+base),common);
  await setDoc(doc(db,'club_polls','poll_'+base),common);
  await Promise.all(names.map(name=>saveLegacyParticipation(db,'club_schedules','sched_'+base,base,name,true)));
  await saveLegacyParticipation(db,'club_schedules','sched_'+base,base,names[0],true);
  assert.equal((await getDoc(doc(db,'club_schedules','sched_'+base))).data()?.attendees.length,4);
  await Promise.all(names.slice(0,3).map(name=>saveLegacyParticipation(db,'club_polls','poll_'+base,base,name,'A')));
  assert.equal((await getDoc(doc(db,'club_polls','poll_'+base))).data()?.votes.length,3);
  await assert.rejects(saveLegacyParticipation(db,'club_polls','poll_'+base,base,names[3],'B'));
  await assert.rejects(saveLegacyParticipation(db,'club_schedules','sched_'+base,base+1,names[0],false));
  await setLegacyManagers(db,club,'admin-'+base,[base,base+1,base+2]);
  await assert.rejects(setLegacyManagers(db,club,'admin-'+base,[base+3]));
  await assert.rejects(setLegacyManagers(db,club,'admin-'+base,[base,base+1,base+2,base+3]));
  for(let i=0;i<23;i++){
   const source='post_'+base+'_'+i;
   await setDoc(doc(db,'club_posts',source),{id:base+i,club_id:base,content:'글'});
   await setDoc(doc(db,'clubs',club,'feed',String(i).padStart(3,'0')),{priority:10,sortAt:100,sourceCollection:'club_posts',sourceId:source});
  }
  const a=await readLegacyFeedPage(db,base,null),b=await readLegacyFeedPage(db,base,a.nextCursor),c=await readLegacyFeedPage(db,base,b.nextCursor);
  assert.deepEqual([a.postsSnap.docs.length,b.postsSnap.docs.length,c.postsSnap.docs.length],[10,10,3]);
  assert.equal(new Set([...a.postsSnap.docs,...b.postsSnap.docs,...c.postsSnap.docs].map(d=>d.ref.id)).size,23);
 }finally{await terminate(db);await deleteApp(app);}
});
