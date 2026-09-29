import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {dispatchApi} from '../src/apiGateway.js';
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8084';
// 모집 인원이 있으면 10명이 동시에 신청해도 정원만큼만 들어가고 나머지는 거부된다.
test('schedule capacity holds under concurrent attend',async()=>{
 const app=initializeApp({projectId:'demo-moyoung-security'},'capacity'),db=getFirestore(app);
 const call=(path,method='GET',body={},token='')=>dispatchApi(db,{url:new URL(path,'https://test.invalid'),method,body,token,ip:'cap-'+token.slice(0,6)},{sendCode:async()=>{},sendUnlock:async()=>{}});
 try {
  await db.doc('clubs/41').set({id:41,name:'정원',manager_ids:['4100']});
  await db.doc('cells/base').set({id:1,name:'둔산제일교회'});
  const names=Array.from({length:11},(_,i)=>`cap${i}`);
  await Promise.all(names.map((u,i)=>db.doc('users/'+u).set({id:4100+i,username:u,name:u+' 실명',role:'member',cell_name:'둔산제일교회'})));
  const tokens=await Promise.all(names.map(async u=>(await (await call('/api/auth/login','POST',{username:u,name:u+' 실명'})).json()).token));
  const bad=await call('/api/clubs/41/schedules','POST',{title:'잘못',event_date:'2099-01-01 19:00 ~ 21:00',max_attendees:0},tokens[0]);
  assert.equal(bad.status,400);
  const created=await (await call('/api/clubs/41/schedules','POST',{title:'정원 4',event_date:'2099-01-01 19:00 ~ 21:00',max_attendees:4},tokens[0])).json();
  const id=created.schedule.id;
  const results=await Promise.all(tokens.slice(1).map(t=>call(`/api/clubs/41/schedules/${id}/attend`,'POST',{attending:true},t)));
  const ok=results.filter(r=>r.status===200).length, full=results.filter(r=>r.status===409).length;
  assert.equal(ok,3); assert.equal(full,7);
  const count=(await db.collection(`club_schedules/sched_${id}/attendance`).get()).size;
  assert.equal(count,4);
  const again=await call(`/api/clubs/41/schedules/${id}/attend`,'POST',{attending:true},tokens[0]);
  assert.equal(again.status,200);
 } finally { await deleteApp(app); }
});
