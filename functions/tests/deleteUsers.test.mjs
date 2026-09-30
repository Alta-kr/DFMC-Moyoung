import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {dispatchApi} from '../src/apiGateway.js';
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8084';
// 서버관리자만 회원을 선택 삭제할 수 있고, 삭제된 회원은 총무 명단에서도 빠진다.
test('server admin deletes selected members and cleans manager lists',async()=>{
 const app=initializeApp({projectId:'demo-moyoung-security'},'delete-users'),db=getFirestore(app);
 let otp;
 const call=(path,method='GET',body={},token='')=>dispatchApi(db,{url:new URL(path,'https://test.invalid'),method,body,token,ip:'del-'+path.length},{sendCode:async(u,code)=>{otp=code;},sendUnlock:async()=>{}});
 const user=(id,username,role='member')=>({id,username,name:username+' 실명',role,cell_name:'둔산제일교회'});
 try {
  await Promise.all([
   db.doc('users/sa9').set(user(901,'sa9','server_admin')), db.doc('users/head9').set(user(902,'head9','head_admin')),
   db.doc('users/user901').set(user(903,'user901')), db.doc('users/user902').set(user(904,'user902')), db.doc('users/keep9').set(user(905,'keep9')),
   db.doc('clubs/91').set({id:91,name:'아이디',manager_ids:['903','905'],manager_names:'user901 실명, keep9 실명'}),
   db.doc('clubs/92').set({id:92,name:'이름',manager_names:'user902 실명, keep9 실명'}),
   db.doc('cells/base').set({id:1,name:'둔산제일교회'})]);
  const head=await (await call('/api/auth/login','POST',{username:'head9',name:'head9 실명'})).json();
  assert.equal((await call('/api/server-admin/delete-users','POST',{usernames:['user901']},head.token)).status,403);
  const challenge=await (await call('/api/auth/admin-login','POST',{username:'sa9',name:'sa9 실명'})).json();
  const sa=await (await call('/api/auth/verify-2fa','POST',{tempToken:challenge.tempToken,code:otp})).json();
  assert.equal((await call('/api/server-admin/delete-users','POST',{usernames:['sa9']},sa.token)).status,400);
  assert.equal((await call('/api/server-admin/delete-users','POST',{usernames:[]},sa.token)).status,400);
  const res=await call('/api/server-admin/delete-users','POST',{usernames:['user901','user902','missing']},sa.token);
  assert.equal(res.status,200);
  assert.deepEqual((await res.json()).deleted.sort(),['user901','user902']);
  assert.equal((await db.doc('users/user901').get()).exists,false);
  assert.equal((await db.doc('users/keep9').get()).exists,true);
  const c1=(await db.doc('clubs/91').get()).data(), c2=(await db.doc('clubs/92').get()).data();
  assert.deepEqual(c1.manager_ids,['905']); assert.equal(c1.manager_names,'keep9 실명'); assert.equal(c2.manager_names,'keep9 실명');
 } finally { await deleteApp(app); }
});
