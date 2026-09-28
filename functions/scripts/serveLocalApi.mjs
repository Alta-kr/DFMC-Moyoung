import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import ts from '../../client/node_modules/typescript/lib/typescript.js';
import {dispatchApi} from '../src/apiGateway.js';

// This entry point cannot connect to a production project or public interface.
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8082') throw new Error('Start with the demo UI emulator launcher');
const app=initializeApp({projectId:'demo-moyoung-ui'}),db=getFirestore(app);
const source=(await readFile(new URL('../../client/src/firebase/firebaseService.ts',import.meta.url),'utf8'))
  .replace("'firebase/firestore'",JSON.stringify(new URL('../src/adminFirestore.js',import.meta.url).href))
  .replace("import { db } from './config';",'')
  .replace('ensureFirebaseSeeded()', 'ensureFirebaseSeeded(db: any)')
  .replace("if (!import.meta.env.DEV || import.meta.env.MODE !== 'ui-preview') return;",'');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
await (await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))).ensureFirebaseSeeded(db);
await import('./prepareUiRoles.mjs');
const server=createServer(async(req,res)=>{
 try {
  let raw='';
  for await (const chunk of req) {raw+=chunk;if(raw.length>65536)throw Object.assign(new Error('입력이 너무 큽니다.'),{status:413});}
  const response=await dispatchApi(db,{url:new URL(req.url,'http://127.0.0.1:5002'),method:req.method,
   body:raw?(String(req.headers['content-type']).startsWith('application/x-www-form-urlencoded')?Object.fromEntries(new URLSearchParams(raw)):JSON.parse(raw)):{},token:(req.headers.authorization||'').replace(/^Bearer /,''),ip:'local'},
   {sendCode:async(username,code)=>console.log(`[로컬 demo 전용] ${username} 인증번호: ${code}`),
    sendUnlock:async(username,token)=>console.log(`[로컬 demo 전용] ${username} 잠금 해제: http://127.0.0.1:3001/api/auth/unlock?t=${token}`)});
  res.writeHead(response.status,{'Content-Type':response.headers.get('content-type')||'application/json','Cache-Control':'no-store'});res.end(await response.text());
 }catch(error){res.writeHead(error.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.status?error.message:'요청 처리 실패',...(error.is_locked?{is_locked:true}:{})}));}
});
server.listen(5002,'127.0.0.1');
const vite=spawn(process.execPath,['node_modules/vite/bin/vite.js','--mode','ui-preview','--host','127.0.0.1','--port','3001','--strictPort'],{cwd:new URL('../../client/',import.meta.url),stdio:'inherit'});
const stop=()=>{vite.kill();server.close();};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
vite.on('exit',()=>server.close());
