import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase/app';
import {getStorage,connectStorageEmulator,ref,uploadBytes} from 'firebase/storage';
test('new image writes are denied by Storage Rules',async()=>{
 const app=initializeApp({projectId:'demo-moyoung-ui',storageBucket:'demo-moyoung-ui.appspot.com'},'storage-policy');
 try{
  const storage=getStorage(app);connectStorageEmulator(storage,'127.0.0.1',9198);
  await assert.rejects(uploadBytes(ref(storage,'tests/new-image.jpg'),new Uint8Array([1,2,3])),(error:any)=>error.code==='storage/unauthorized');
 }finally{await deleteApp(app);}
});
