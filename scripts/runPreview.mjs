import { spawn } from 'node:child_process';
import { putFixture, seedMemberFeed } from '../client/tests/previewFixtures.ts';
const email = 'preview@example.test', password = 'Moyoung-local-123!';
const endpoint = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:';
async function auth(action) {
  const response = await fetch(endpoint + action + '?key=demo-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return response.json();
}
let account = await auth('signUp');
if (account.error?.message === 'EMAIL_EXISTS') account = await auth('signInWithPassword');
if (!account.localId) throw new Error('Local preview account could not be prepared');
await putFixture('users/' + account.localId, { uid: account.localId, name: '체험 회원', role: 'member' });
await seedMemberFeed(account.localId, 'preview-club');
console.log('\n모영 체험 준비 완료\nhttp://127.0.0.1:3000\n이메일: ' + email + '\n비밀번호: ' + password + '\n종료: 이 창에서 Ctrl+C\n');
const child = spawn(process.execPath, [
  'node_modules/vite/bin/vite.js', '--mode', 'auth-preview',
  '--host', '127.0.0.1', '--port', '3000', '--strictPort',
], { cwd: new URL('../client/', import.meta.url), stdio: 'inherit' });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 0; });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
