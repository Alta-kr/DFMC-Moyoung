import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {dispatchApi} from '../src/apiGateway.js';
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8084';
// 참석·투표는 회원별 문서로 저장되어 20명이 동시에 신청해도 한 문서를 두고 경합하지 않는다.
test('20 members attending and voting at once: all succeed, no duplicates, legacy arrays migrated',async()=>{
 const app=initializeApp({projectId:'demo-moyoung-security'},'concurrent-attend'),db=getFirestore(app);
 const call=(path,method='GET',body={},token='')=>dispatchApi(db,{url:new URL(path,'https://test.invalid'),method,body,token,ip:'attend-'+token.slice(0,6)},{sendCode:async()=>{},sendUnlock:async()=>{}});
 try {
  await db.doc('clubs/31').set({id:31,name:'동시',manager_ids:['3100']});
  await db.doc('cells/base').set({id:1,name:'둔산제일교회'});
  const names=Array.from({length:20},(_,i)=>`crowd${i}`);
  await Promise.all(names.map((u,i)=>db.doc('users/'+u).set({id:3100+i,username:u,name:u+' 실명',role:'member',cell_name:'둔산제일교회'})));
  const tokens=await Promise.all(names.map(async u=>(await (await call('/api/auth/login','POST',{username:u,name:u+' 실명'})).json()).token));
  const leader=tokens[0];
  for(let round=0;round<3;round++) {
   const created=await (await call('/api/clubs/31/schedules','POST',{title:'동시 '+round,event_date:'2099-01-01 19:00 ~ 21:00'},leader)).json();
   const id=created.schedule.id;
   const started=Date.now();
   const results=await Promise.all(tokens.map(token=>call(`/api/clubs/31/schedules/${id}/attend`,'POST',{attending:true},token).then(r=>r.status,e=>e.status||500)));
   const ms=Date.now()-started;
   assert.deepEqual(results.filter(s=>s!==200),[],`round ${round}`);
   const attendees=(await db.collection(`club_schedules/sched_${id}/attendance`).get()).docs.map(d=>d.data().user_id);
   assert.equal(attendees.length,20,'creator + 19 others, creator counted once');
   assert.equal(new Set(attendees).size,20);
   assert.ok(ms<15000,`round ${round} took ${ms}ms`);
   console.log(`round ${round}: 20 concurrent attends in ${ms}ms`);
  }
  const poll=(await (await call('/api/clubs/31/polls','POST',{title:'동시 투표',options:['1안','2안','3안'],end_date:'2099-12-31'},leader)).json()).poll;
  const votes=await Promise.all(tokens.map((token,i)=>call(`/api/clubs/31/polls/${poll.id}/vote`,'POST',{option:['1안','2안','3안'][i%3]},token).then(r=>r.status)));
  assert.deepEqual(votes.filter(s=>s!==200),[]);
  const club=await (await call('/api/clubs/31','GET',{},leader)).json();
  const p=club.polls.find(x=>x.id===poll.id);
  assert.deepEqual(p.option_counts,{'1안':7,'2안':7,'3안':6});
  assert.equal(p.total_votes,20);
  assert.equal(p.my_vote,'1안');
  // 변경 투표는 덮어쓴다.
  await call(`/api/clubs/31/polls/${poll.id}/vote`,'POST',{option:'3안'},leader);
  const p2=(await (await call('/api/clubs/31','GET',{},leader)).json()).polls.find(x=>x.id===poll.id);
  assert.deepEqual(p2.option_counts,{'1안':6,'2안':7,'3안':7});

  // 이전 방식(배열) 일정: 기존 참석자를 유지한 채 옮겨지고, 동시 신청도 모두 반영된다.
  await db.doc('club_schedules/sched_31999').set({id:31999,club_id:31,title:'이전',event_date:'2099-01-02',attendees:[
   {user_id:3100,user_name:'crowd0 실명'},{user_id:999999,user_name:'이전 회원'}]});
  const legacy=await Promise.all(tokens.slice(1,6).map(token=>call('/api/clubs/31/schedules/31999/attend','POST',{attending:true},token).then(r=>r.status)));
  assert.deepEqual(legacy.filter(s=>s!==200),[]);
  const migrated=(await (await call('/api/clubs/31','GET',{},leader)).json()).schedules.find(s=>s.id===31999);
  assert.equal(migrated.attendees.length,7);
  assert.equal(migrated.is_attending,true);
  assert.equal((await db.doc('club_schedules/sched_31999').get()).data().participation_v,2);
  // 참석 취소
  const cancel=await (await call('/api/clubs/31/schedules/31999/attend','POST',{attending:false},tokens[1])).json();
  assert.equal(cancel.attendees.length,6);
  // 홈 화면 인원 수
  const lobby=await (await call('/api/lobby/data','GET',{},leader)).json();
  assert.ok(lobby.schedules.some(s=>s.club_id===31&&s.attendees_count>=6));
  // 일정 삭제 시 참석 문서도 지운다.
  await call('/api/clubs/31/schedules/31999','DELETE',{},leader);
  assert.equal((await db.collection('club_schedules/sched_31999/attendance').get()).size,0);
 } finally { await db.terminate(); await deleteApp(app); }
});

test('contended transactions retry and finally report a busy error instead of 500',async()=>{
 const {runTransaction}=await import('../src/adminFirestore.js');
 let calls=0;
 const flaky={runTransaction:async()=>{ if(++calls<3) throw Object.assign(new Error('10 ABORTED: Transaction lock timeout'),{code:10}); return 'ok'; }};
 assert.equal(await runTransaction(flaky,async()=>{}),'ok');
 assert.equal(calls,3);
 const busy={runTransaction:async()=>{ throw Object.assign(new Error('10 ABORTED: Too much contention'),{code:10}); }};
 await assert.rejects(runTransaction(busy,async()=>{}),error=>error.status===503);
 const other={runTransaction:async()=>{ throw new Error('마감된 참여입니다.'); }};
 await assert.rejects(runTransaction(other,async()=>{}),/마감된 참여/);
});
