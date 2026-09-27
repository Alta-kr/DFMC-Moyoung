import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getFirestore,connectFirestoreEmulator,doc,setDoc,getDoc,terminate} from 'firebase/firestore';
import {proposeHandover,agreeHandover,pendingHandovers} from '../src/firebase/legacyManagers.ts';
test('manager handover needs two current managers and keeps 1..3 non-guest managers',async()=>{
 const app=initializeApp({projectId:'demo-moyoung-ui'},'handover-'+Date.now());
 const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8082);
 const base=Date.now()+500000,club=String(base),key=(i:number)=>'handover-'+base+'-'+i;
 try{
  await Promise.all([0,1,2,3,4].map(i=>setDoc(doc(db,'users',key(i)),{username:key(i),id:base+i,name:'총무'+i,role:i===4?'guest':'member'})));
  await setDoc(doc(db,'clubs',club),{name:'인계',manager_ids:[String(base)],manager_names:'총무0'});
  const managers=async()=>(await getDoc(doc(db,'clubs',club))).data()?.manager_ids;
  // 총무 1명이면 발의자 동의만으로 반영
  await proposeHandover(db,club,key(0),base+1,'appoint');
  assert.deepEqual(await managers(),[String(base),String(base+1)]);
  await assert.rejects(proposeHandover(db,club,key(2),base+2,'appoint'),/현직 총무/);
  await assert.rejects(proposeHandover(db,club,key(0),base+4,'appoint'),/게스트/);
  // 2명이면 다른 총무 1명 동의 필요
  await proposeHandover(db,club,key(0),base+2,'appoint');
  assert.equal((await managers()).length,2);
  await assert.rejects(proposeHandover(db,club,key(1),base+2,'appoint'),/이미 진행/);
  const [vote]=await pendingHandovers(db,base,{id:base+1});
  assert.equal(vote.has_agreed,false);
  await assert.rejects(agreeHandover(db,club,key(0),String(vote.id)),/이미 동의/);
  await assert.rejects(agreeHandover(db,club,key(3),String(vote.id)),/현직 총무/);
  await agreeHandover(db,club,key(1),String(vote.id));
  assert.deepEqual(await managers(),[String(base),String(base+1),String(base+2)]);
  assert.equal((await getDoc(doc(db,'clubs',club))).data()?.manager_names,'총무0, 총무1, 총무2');
  assert.equal((await pendingHandovers(db,base,{id:base})).length,0);
  await assert.rejects(proposeHandover(db,club,key(0),base+3,'appoint'),/3명/);
  // 해임
  await proposeHandover(db,club,key(1),base,'dismiss');
  const [dismiss]=await pendingHandovers(db,base,{id:base+2});
  await agreeHandover(db,club,key(2),String(dismiss.id));
  assert.deepEqual(await managers(),[String(base+1),String(base+2)]);
 }finally{await terminate(db);await deleteApp(app);}
});
