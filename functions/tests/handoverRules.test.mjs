import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {dispatchApi} from '../src/apiGateway.js';
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8084';
// 동의 인원: 총무 1명이면 혼자, 2명이면 둘 다, 3명이면 2명. 위임은 본인 자리만 넘기므로 혼자 가능.
test('handover approval counts and self delegation',async()=>{
 const app=initializeApp({projectId:'demo-moyoung-security'},'handover-rules'),db=getFirestore(app);
 const call=(path,method='GET',body={},token='')=>dispatchApi(db,{url:new URL(path,'https://test.invalid'),method,body,token,ip:'ho-'+token.slice(0,5)},{sendCode:async()=>{},sendUnlock:async()=>{}});
 const u=(id,username,extra={})=>({id,username,name:username,role:'member',cell_name:'둔산제일교회',...extra});
 try {
  await db.doc('cells/base').set({id:1,name:'둔산제일교회'});
  await Promise.all(['a','b','c','d','e'].map((n,i)=>db.doc('users/ho'+n).set(u(7100+i,'ho'+n))));
  await db.doc('users/hog').set(u(7199,'hog',{role:'guest',is_guest:true}));
  await db.doc('clubs/71').set({id:71,name:'규칙',manager_ids:['7100'],manager_names:'hoa'});
  const t={}; for(const n of ['a','b','c','d','e']) t[n]=(await (await call('/api/auth/login','POST',{username:'ho'+n,name:'ho'+n})).json()).token;
  const ids=async()=>(await db.doc('clubs/71').get()).data().manager_ids;
  // 1명: 혼자 추가
  await call('/api/clubs/71/handover/propose','POST',{targetUserId:7101,actionType:'appoint'},t.a);
  assert.deepEqual(await ids(),['7100','7101']);
  // 2명: 발의만으로는 안 되고 둘 다 동의해야
  const r=await (await call('/api/clubs/71/handover/propose','POST',{targetUserId:7102,actionType:'appoint'},t.a)).json();
  assert.deepEqual(await ids(),['7100','7101']);
  const vote=(await db.collection('club_handover_votes').where('club_id','==',71).where('status','==','pending').get()).docs[0].data();
  await call(`/api/clubs/71/handover/${vote.id}/agree`,'POST',{},t.b);
  assert.deepEqual(await ids(),['7100','7101','7102']);
  // 3명: 2명 동의로 해임
  await call('/api/clubs/71/handover/propose','POST',{targetUserId:7102,actionType:'dismiss'},t.a);
  assert.equal((await ids()).length,3);
  const v2=(await db.collection('club_handover_votes').where('club_id','==',71).where('status','==','pending').get()).docs[0].data();
  await call(`/api/clubs/71/handover/${v2.id}/agree`,'POST',{},t.b);
  assert.deepEqual(await ids(),['7100','7101']);
  // 위임: 본인 자리만 바뀌고 다른 총무 동의 불필요
  const d=await call('/api/clubs/71/handover/delegate','POST',{targetUserId:7103},t.b);
  assert.equal(d.status,200);
  assert.deepEqual(await ids(),['7100','7103']);
  assert.equal((await db.doc('clubs/71').get()).data().manager_names,'hoa, hod');
  // 총무가 아닌 사람, 게스트 대상, 이미 총무인 대상은 거부
  assert.equal((await call('/api/clubs/71/handover/delegate','POST',{targetUserId:7104},t.b)).status,403);
  assert.equal((await call('/api/clubs/71/handover/delegate','POST',{targetUserId:7199},t.a)).status,400);
  assert.equal((await call('/api/clubs/71/handover/delegate','POST',{targetUserId:7103},t.a)).status,400);
 } finally { await deleteApp(app); }
});
