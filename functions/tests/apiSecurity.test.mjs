import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {dispatchApi} from '../src/apiGateway.js';
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8084';
test('name/id sessions, server authorization, OTP replay and closed database',async()=>{
 const app=initializeApp({projectId:'demo-moyoung-security'}),db=getFirestore(app);
 let otp,unlock;
 const call=(path,method='GET',body={},token='')=>dispatchApi(db,{url:new URL(path,'https://test.invalid'),method,body,token,ip:'local-test'},{sendCode:async(username,code)=>{otp=code;},sendUnlock:async(username,token)=>{unlock=token;}});
 const user=(id,username,role='member')=>({id,username,name:username+' 실명',role,cell_name:'둔산제일교회'});
 try {
  await Promise.all([
   db.doc('users/member').set(user(1,'member')),db.doc('users/other').set(user(2,'other')),
   db.doc('users/admin').set(user(3,'admin','server_admin')),db.doc('users/leader').set(user(4,'leader')),
   db.doc('clubs/1').set({id:1,name:'테스트',manager_ids:['4'],manager_names:'leader 실명'}),
   db.doc('cells/base').set({id:1,name:'둔산제일교회'}),
   db.doc('club_posts/post_1').set({id:1,club_id:1,user_id:2,content:'보호할 글'}),
   db.doc('club_polls/poll_1').set({id:1,club_id:1,title:'투표',options:['A','B'],end_date:'2099-01-01',votes:[]}),
   db.doc('club_schedules/sched_1').set({id:1,club_id:1,event_date:'2099-01-01',startsAtMs:4070876400000,endsAtMs:4070880000000,attendees:[]}),
  ]);
  await assert.rejects(call('/api/auth/login','POST',{username:'member',name:'틀린 이름'}),error=>error.status===401);
  const member=await (await call('/api/auth/login','POST',{username:'member',name:'member 실명'})).json();
  assert.match(member.token,/^[\w-]{43}$/);
  const registered=await (await call('/api/auth/register','POST',{username:'newmember',name:'신규',cell_name:'둔산제일교회',role:'server_admin',manager_ids:['1']})).json();
  assert.equal(registered.user.role,'member');
  assert.equal((await db.doc('users/newmember').get()).data().manager_ids,undefined);
  assert.equal((await call('/api/lobby/data')).status,200);
  await assert.rejects(call('/api/auth/me','GET',{},'dfmc_token_admin'),error=>error.status===401);
  assert.equal((await call('/api/head-admin/members','GET',{},member.token)).status,403);
  assert.equal((await call('/api/clubs/1/posts/1','DELETE',{},member.token)).status,403);
  assert.equal((await call('/api/clubs/1/info','POST',{name:'탈취'},member.token)).status,403);
  const votes=await Promise.all(['A','B'].map(option=>call('/api/clubs/1/polls/1/vote','POST',{option},member.token)));
  assert.ok(votes.every(result=>result.ok));
  assert.equal((await db.doc('club_polls/poll_1').get()).data().votes.length,1);
  const guest=await (await call('/api/auth/guest-login','POST',{name:'손님',acquaintance_name:'친구'})).json();
  await assert.rejects(call('/api/clubs/1','GET',{},guest.token),error=>error.status===403);
  assert.equal((await call('/api/clubs/1/schedules/1/attend','POST',{attending:true},guest.token)).status,200);
  await assert.rejects(call('/api/auth/login','POST',{username:'admin',name:'admin 실명'}),error=>error.status===401);
  await assert.rejects(call('/api/auth/admin-login','POST',{username:'member',name:'member 실명'}),error=>error.status===401);
  const challenge=await (await call('/api/auth/admin-login','POST',{username:'admin',name:'admin 실명'})).json();
  assert.equal(challenge.requires2FA,true); assert.equal(challenge.token,undefined);
  const admin=await (await call('/api/auth/verify-2fa','POST',{tempToken:challenge.tempToken,code:otp})).json();
  await assert.rejects(call('/api/auth/verify-2fa','POST',{tempToken:challenge.tempToken,code:otp}),error=>error.status===401);
  assert.equal((await call('/api/head-admin/members','GET',{},admin.token)).status,200);
  assert.equal((await call('/api/head-admin/cells/base','DELETE',{},admin.token)).status,400);
  const leader=await (await call('/api/auth/login','POST',{username:'leader',name:'leader 실명'})).json();
  assert.equal(leader.requires2FA,undefined);
  assert.ok(leader.token);
  await db.doc('users/head').set(user(7,'head','head_admin'));
  const headLogin=await (await call('/api/auth/login','POST',{username:'head',name:'head 실명'})).json();
  assert.equal(headLogin.requires2FA,undefined);
  assert.equal((await call('/api/head-admin/members','GET',{},headLogin.token)).status,200);
  await db.doc('users/media').set(user(8,'media','media_admin'));
  const media=await (await call('/api/auth/login','POST',{username:'media',name:'media 실명'})).json();
  assert.equal(media.requires2FA,undefined);
  assert.equal((await call('/api/head-admin/notices','GET',{},media.token)).status,200);
  // Five wrong codes across challenges lock the admin until the mailed link is confirmed.
  const wrong=code=>code==='11111'?'22222':'11111';
  const first=await (await call('/api/auth/admin-login','POST',{username:'admin',name:'admin 실명'})).json();
  for(let i=0;i<3;i++) await assert.rejects(call('/api/auth/verify-2fa','POST',{tempToken:first.tempToken,code:wrong(otp)}),error=>error.status===401);
  const retry=await (await call('/api/auth/admin-login','POST',{username:'admin',name:'admin 실명'})).json();
  const retryCode=otp;
  await assert.rejects(call('/api/auth/verify-2fa','POST',{tempToken:retry.tempToken,code:wrong(retryCode)}),error=>error.status===401);
  assert.equal(unlock,undefined);
  await assert.rejects(call('/api/auth/verify-2fa','POST',{tempToken:retry.tempToken,code:wrong(retryCode)}),error=>error.status===423&&error.is_locked);
  assert.match(unlock,/^[\w-]{43}$/);
  await assert.rejects(call('/api/auth/verify-2fa','POST',{tempToken:retry.tempToken,code:retryCode}),error=>error.status===423);
  await assert.rejects(call('/api/auth/admin-login','POST',{username:'admin',name:'admin 실명'}),error=>error.status===423);
  const confirmPage=await call('/api/auth/unlock?t='+unlock);
  assert.match(confirmPage.headers.get('content-type'),/text\/html/);
  assert.match(await confirmPage.text(),/method="post"/);
  assert.equal((await db.doc('_apiLocks/admin').get()).data().locked,true);
  assert.match(await (await call('/api/auth/unlock','POST',{t:'x'.repeat(43)})).text(),/만료된 링크/);
  assert.match(await (await call('/api/auth/unlock','POST',{t:unlock})).text(),/해제되었습니다/);
  assert.equal((await db.doc('_apiLocks/admin').get()).exists,false);
  assert.match(await (await call('/api/auth/unlock','POST',{t:unlock})).text(),/만료된 링크/);
  const again=await (await call('/api/auth/admin-login','POST',{username:'admin',name:'admin 실명'})).json();
  assert.ok((await (await call('/api/auth/verify-2fa','POST',{tempToken:again.tempToken,code:otp})).json()).token);
  await db.doc('users/member').update({role:'server_admin'});
  await assert.rejects(call('/api/head-admin/members','GET',{},member.token),error=>error.status===401);
  await call('/api/auth/logout','POST',{},admin.token);
  await assert.rejects(call('/api/auth/me','GET',{},admin.token),error=>error.status===401);
  await db.doc('users/newmember').update({disabled:true});
  await assert.rejects(call('/api/auth/me','GET',{},registered.token),error=>error.status===401);
  const endpoint='http://127.0.0.1:8084/v1/projects/demo-moyoung-security/databases/(default)/documents/';
  for(const path of ['users/member','_apiSessions','server_security/current_code','clubs/1']) {
   assert.equal((await fetch(endpoint+path)).status,403,path);
  }
  assert.equal((await fetch(endpoint+'users/member',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:{role:{stringValue:'server_admin'}}})})).status,403);
 }finally{await db.terminate();await deleteApp(app);}
});
