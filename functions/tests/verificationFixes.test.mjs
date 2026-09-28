import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {dispatchApi} from '../src/apiGateway.js';
process.env.FIRESTORE_EMULATOR_HOST='127.0.0.1:8084';
// 2026-09-28 역할별 검증에서 나온 버그 회귀 테스트.
test('comment moderation, cell change, welcomes, popup, lobby fields and server console',async()=>{
 const app=initializeApp({projectId:'demo-moyoung-security'},'verification-fixes'),db=getFirestore(app);
 const call=async(path,method='GET',body={},token='')=>{
  try { return await dispatchApi(db,{url:new URL(path,'https://test.invalid'),method,body,token,ip:'fix-test'},{sendCode:async()=>{},sendUnlock:async()=>{}}); }
  catch(error){ return new Response(JSON.stringify({error:error.message}),{status:error.status||500}); }
 };
 const user=(id,username,role='member',cell='둔산제일교회')=>({id,username,name:username+' 실명',role,cell_name:cell});
 const login=async username=>(await (await call('/api/auth/login','POST',{username,name:username+' 실명'})).json()).token;
 try {
  await Promise.all([
   db.doc('users/fmember').set(user(101,'fmember')),db.doc('users/fleader').set(user(102,'fleader')),
   db.doc('users/fmedia').set(user(103,'fmedia','media_admin')),db.doc('users/fhead').set(user(104,'fhead','head_admin')),
   db.doc('users/fserver').set(user(105,'fserver','server_admin')),db.doc('users/fcell').set(user(106,'fcell','member','장년 1셀')),
   db.doc('clubs/9').set({id:9,name:'검증',manager_ids:['102'],manager_names:'fleader 실명'}),
   db.doc('cells/base').set({id:1,name:'둔산제일교회'}),db.doc('cells/c1').set({id:2,name:'1청년부 1셀'}),
   db.doc('club_posts/post_9').set({id:9,club_id:9,user_id:102,content:'총무 글'}),
   db.doc('notices/n1').set({id:1,title:'공지',content:'내용',author_name:'관리자 이름',is_active:1,created_at:'2026-09-28T00:00:00Z'}),
   db.doc('popups/popup_1').set({id:1,title:'현재 팝업',content_text:'본문',image_url:'',end_date:'2099-01-01',is_active:1}),
  ]);
  const [member,leader,media,head]=await Promise.all(['fmember','fleader','fmedia','fhead'].map(login));

  // 소속 셀 변경: 화면이 보내는 cell_name을 받는다.
  const cell=await call('/api/lobby/update-cell','POST',{cell_name:'1청년부 1셀'},member);
  assert.equal(cell.status,200);
  assert.equal((await db.doc('users/fmember').get()).data().cell_name,'1청년부 1셀');

  // 일반 회원은 글을 쓸 수 없고 총무는 쓸 수 있다.
  assert.equal((await call('/api/clubs/9/posts','POST',{content:'회원 글'},member)).status,403);
  assert.equal((await call('/api/clubs/9/posts','POST',{content:'미디어 글'},media)).status,403);
  assert.equal((await call('/api/clubs/9/posts','POST',{content:'총무 새 글'},leader)).status,200);

  // 댓글 삭제: 총무·미디어·전체 관리자 허용, 다른 회원 거부.
  const comment=async()=>(await (await call('/api/clubs/9/posts/9/comments','POST',{content:'회원 댓글'},member)).json()).comment.id;
  const c1=await comment();
  assert.equal((await call(`/api/clubs/9/comments/${c1}`,'DELETE',{},await login('fcell'))).status,403);
  for(const token of [leader,media,head]) {
   const id=await comment();
   assert.equal((await call(`/api/clubs/9/comments/${id}`,'DELETE',{},token)).status,200);
   assert.equal((await db.doc(`club_comments/comm_${id}`).get()).exists,false);
  }

  // 맞춤 환영: 미디어 관리자가 대상 목록을 보고 저장, 대상 회원 로비에만 노출.
  const members=await (await call('/api/head-admin/members','GET',{},media)).json();
  assert.ok(members.members.some(m=>m.id===101));
  assert.equal(members.members[0].username,undefined);
  assert.equal((await call('/api/head-admin/targeted-welcomes','POST',{group_name:'새가족',welcome_tagline:'반가워요',welcome_message:'환영합니다',user_ids:[]},media)).status,400);
  assert.equal((await call('/api/head-admin/targeted-welcomes','POST',{group_name:'새가족',welcome_tagline:'반가워요',welcome_message:'환영합니다',user_ids:[101]},media)).status,200);
  const saved=(await (await call('/api/head-admin/targeted-welcomes','GET',{},media)).json()).targetedWelcomes.find(t=>t.group_name==='새가족');
  assert.equal(saved.welcome_tagline,'반가워요');
  const lobby=await (await call('/api/lobby/data','GET',{},member)).json();
  assert.equal(lobby.welcome.welcome_tagline,'반가워요');
  assert.equal(lobby.welcome.is_targeted,true);
  assert.equal(lobby.notice.author_name,'관리자 이름');
  assert.equal(lobby.clubs.find(c=>c.id===9).manager_names,'fleader 실명');
  assert.notEqual((await (await call('/api/lobby/data','GET',{},leader)).json()).welcome.welcome_tagline,'반가워요');

  // 팝업 설정은 현재 팝업을 돌려준다(화면이 두 형태 모두 읽음).
  assert.equal((await (await call('/api/head-admin/popup','GET',{},media)).json()).title,'현재 팝업');

  // 서버 콘솔: 잠금 초기화가 실제로 지우고, 지표는 실제 값이다.
  const serverToken=(await (await call('/api/auth/admin-login','POST',{username:'fserver',name:'fserver 실명'})).json()).tempToken;
  assert.ok(serverToken);
  await db.doc('_apiLocks/fserver').set({failures:2,locked:false});
  const admin=await db.doc('users/fserver').get();
  const {issueSession}=await import('../src/legacyAuth.js');
  const session=(await issueSession(db,{...admin.data(),username:'fserver'},true)).token;
  const metrics=await (await call('/api/server-admin/metrics','GET',{},session)).json();
  assert.equal(metrics.security.fail_count,2);
  assert.equal(metrics.storage,undefined);
  assert.ok(metrics.traffic.active_sessions>=1);
  assert.equal((await call('/api/server-admin/reset-security','POST',{},session)).status,200);
  assert.equal((await db.doc('_apiLocks/fserver').get()).exists,false);
  assert.equal((await call('/api/server-admin/reports/999999','PUT',{status:'resolved'},session)).status,404);
  assert.equal((await call('/api/server-admin/set-role','POST',{userId:106,role:'head_admin'},session)).status,400);
 } finally { await db.terminate(); await deleteApp(app); }
});
