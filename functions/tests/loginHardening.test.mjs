import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {dispatchApi} from '../src/apiGateway.js';
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8084';
test('cell names stay private, admin code mail is capped, login limit is per ID and IP',async()=>{
 const app=initializeApp({projectId:'demo-moyoung-security'},'login-hardening'),db=getFirestore(app);
 let sent=0,unlocks=0;
 const mail={sendCode:async()=>{sent++;},sendUnlock:async()=>{unlocks++;}};
 const call=(path,method='GET',body={},token='',ip='ip-a')=>dispatchApi(db,{url:new URL(path,'https://test.invalid'),method,body,token,ip},mail);
 const user=(id,username,role='member')=>({id,username,name:username+' 실명',role,cell_name:'둔산제일교회'});
 try {
  await Promise.all([
   db.doc('users/hmember').set(user(101,'hmember')),db.doc('users/hadmin').set(user(102,'hadmin','server_admin')),
   db.doc('cells/secret').set({id:9,name:'비밀셀'}),
  ]);
  // Logged-out and guest callers never receive cell names; members still do.
  assert.deepEqual((await (await call('/api/lobby/data')).json()).cells,[]);
  const consents={terms:true,privacy:true,sensitive:true,age14:true};
  const guest=await (await call('/api/auth/guest-login','POST',{name:'손님',acquaintance_name:'친구',consents},'','ip-g')).json();
  assert.deepEqual((await (await call('/api/lobby/data','GET',{},guest.token)).json()).cells,[]);
  const member=await (await call('/api/auth/login','POST',{username:'hmember',name:'hmember 실명'})).json();
  assert.ok((await (await call('/api/lobby/data','GET',{},member.token)).json()).cells.some(cell=>cell.name==='비밀셀'));
  // Five mailed codes without a verification lock the admin; no further code mail goes out.
  for(let i=0;i<5;i++) assert.ok((await (await call('/api/auth/admin-login','POST',{username:'hadmin',name:'hadmin 실명'},'','ip-'+i)).json()).tempToken);
  assert.equal(sent,5);
  await assert.rejects(call('/api/auth/admin-login','POST',{username:'hadmin',name:'hadmin 실명'},'','ip-x'),error=>error.status===423&&error.is_locked);
  await assert.rejects(call('/api/auth/admin-login','POST',{username:'hadmin',name:'hadmin 실명'},'','ip-y'),error=>error.status===423);
  assert.equal(sent,5); assert.equal(unlocks,1);
  // Wrong names from one IP cannot block the same ID from another IP.
  for(let i=0;i<10;i++) await assert.rejects(call('/api/auth/login','POST',{username:'hmember',name:'틀림'},'','ip-attack'),error=>error.status===401);
  await assert.rejects(call('/api/auth/login','POST',{username:'hmember',name:'틀림'},'','ip-attack'),error=>error.status===429);
  assert.ok((await (await call('/api/auth/login','POST',{username:'hmember',name:'hmember 실명'},'','ip-owner')).json()).token);
 }finally{await db.terminate();await deleteApp(app);}
});
