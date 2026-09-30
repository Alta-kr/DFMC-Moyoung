import { randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';
import { findCell } from './cellName.js';
const hash = value => createHash('sha256').update(value).digest('hex');
const randomToken = () => randomBytes(32).toString('base64url');
export const publicUser = user => Object.fromEntries(['id','username','name','cell_name','role','is_guest','cell_verified','created_at'].filter(key => user[key] !== undefined).map(key => [key,user[key]]));
export function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
const text = (value, max = 80) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max ? value.trim() : fail(400,'입력 내용을 확인해주세요.');
const usernameOf = value => { const name = text(value); if (!/^[A-Za-z0-9_-]{1,80}$/.test(name)) fail(400,'아이디 형식을 확인해주세요.'); return name; };
export async function limitRequests(db, key, max = 20, windowMs = 600000) {
  const ref = db.doc('_apiLimits/' + hash(key));
  const accepted = await db.runTransaction(async tx => {
    const old = (await tx.get(ref)).data();
    const now = Date.now(), current = old?.until > now ? old : { count: 0, until: now + windowMs };
    if (current.count >= max) return false;
    tx.set(ref,{ count: current.count + 1, until: current.until, expiresAt: new Date(current.until) });
    return true;
  });
  if (!accepted) fail(429,'요청이 많습니다. 잠시 후 다시 시도해주세요.');
}
export async function needsStepUp(_db, user) {
  return user.role === 'server_admin';
}
// Bump CONSENT_VERSION with client/src/components/SignupConsent.tsx whenever the terms text changes.
export const CONSENT_VERSION = '2026-09-29';
export const CONSENT_ITEMS = ['terms','privacy','age14'];
const LOCK_LIMIT = 5, UNLOCK_MS = 86400000;
const lockedError = () => Object.assign(new Error('관리자 인증을 5회 넘게 실패해 잠겼습니다. 관리자 메일의 잠금 해제 버튼을 눌러주세요.'),{status:423,is_locked:true});
// Issues a one-time unlock link for a locked admin; only the digest is stored.
async function mailUnlock(db, username, mail) {
  const token = randomToken();
  await db.doc('_apiLocks/' + username).set({ unlockDigest: hash(token), unlockExpiresAt: new Date(Date.now() + UNLOCK_MS) },{ merge: true });
  await mail.sendUnlock(username, token);
}
const page = (title, body) => new Response(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${title}</title></head><body style="font-family:sans-serif;max-width:360px;margin:64px auto;padding:0 16px;text-align:center"><h2>${title}</h2>${body}</body></html>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' } });
// GET shows a confirm button so mail link scanners cannot unlock by prefetching.
export async function unlockAdmin(db, method, token) {
  if (!/^[\w-]{43}$/.test(token || '')) return page('잘못된 링크입니다','<p>메일의 버튼을 다시 눌러주세요.</p>');
  if (method === 'GET') return page('관리자 잠금 해제',`<form method="post"><input type="hidden" name="t" value="${token}"><button style="padding:12px 24px;font-size:16px">잠금 해제</button></form>`);
  const locks = await db.collection('_apiLocks').where('unlockDigest','==',hash(token)).limit(1).get();
  const lock = locks.docs[0];
  if (!lock || lock.data().unlockExpiresAt.toMillis() <= Date.now()) return page('만료된 링크입니다','<p>관리자 로그인을 다시 시도하면 새 메일이 발송됩니다.</p>');
  await lock.ref.delete();
  return page('잠금이 해제되었습니다','<p>관리자 로그인을 다시 시도해주세요.</p>');
}
export async function issueSession(db, user, elevated = false) {
  const token = randomToken();
  await db.doc('_apiSessions/' + hash(token)).set({ username: user.username, userId: user.id,
    elevated, expiresAt: new Date(Date.now() + (elevated ? 3600000 : 86400000)) });
  return { token, user: publicUser(user) };
}
export async function resolveSession(db, token) {
  if (!/^[\w-]{43}$/.test(token || '')) return null;
  const ref = db.doc('_apiSessions/' + hash(token)), session = (await ref.get()).data();
  if (!session || session.expiresAt.toMillis() <= Date.now()) return null;
  const profile = await db.doc('users/' + session.username).get();
  const user = profile.data();
  if (!user || user.disabled || user.id !== session.userId) return null;
  if (!session.elevated && await needsStepUp(db,user)) return null;
  return { user: { ...user, username: profile.id }, ref };
}
export async function authenticate(db, path, body, ip, mail) {
  await limitRequests(db,'auth-ip:' + ip,40);
  if (path === '/api/auth/login' || path === '/api/auth/admin-login') {
    const username = usernameOf(body.username), name = text(body.name);
    // Keyed by ID and IP so one caller cannot lock another member out of login.
    await limitRequests(db,'login:' + username + ':' + ip,10);
    const snap = await db.doc('users/' + username).get(), user = snap.data();
    if (!user || user.disabled || user.name !== name || user.role === 'guest' || user.is_guest) fail(401,'아이디와 실명을 확인해주세요.');
    user.username = snap.id;
    const admin = await needsStepUp(db,user);
    // Server admins sign in only through the separate admin login.
    if (admin !== path.endsWith('admin-login')) fail(401,'아이디와 실명을 확인해주세요.');
    if (!admin) return issueSession(db,user);
    // Every mailed code counts until one is verified; past the limit the account locks and no code is sent.
    const lockRef = db.doc('_apiLocks/' + username);
    const lock = await db.runTransaction(async tx => {
      const current = (await tx.get(lockRef)).data() || {};
      if (current.locked) return current;
      const sent = (current.sent || 0) + 1, locked = sent > LOCK_LIMIT;
      tx.set(lockRef,{ sent, locked, updatedAt: new Date() },{ merge: true });
      return { locked, newlyLocked: locked };
    });
    if (lock.locked) {
      if (lock.newlyLocked || !(lock.unlockExpiresAt?.toMillis() > Date.now())) await mailUnlock(db,username,mail);
      throw lockedError();
    }
    const challenge = randomToken(), code = String(randomInt(10000,100000));
    await mail.sendCode(username,code);
    await db.doc('_apiChallenges/' + hash(challenge)).set({ username, userId: user.id,
      digest: hash(challenge + code), attempts: 0, expiresAt: new Date(Date.now()+300000) });
    return { requires2FA: true, tempToken: challenge, devCodeHint: '등록된 관리자 이메일로 인증번호를 보냈습니다.' };
  }
  if (path === '/api/auth/verify-2fa') {
    const challenge = text(body.tempToken,100), code = text(body.code,5);
    if (!/^[\w-]{43}$/.test(challenge) || !/^\d{5}$/.test(code)) fail(400,'인증번호를 확인해주세요.');
    const ref = db.doc('_apiChallenges/' + hash(challenge));
    const result = await db.runTransaction(async tx => {
      const record = (await tx.get(ref)).data();
      if (!record || record.expiresAt.toMillis() <= Date.now() || record.attempts >= 5) return null;
      // Failures count per account across challenges; the fifth one locks it.
      const lockRef = db.doc('_apiLocks/' + record.username), lock = (await tx.get(lockRef)).data() || {};
      if (lock.locked) return 'locked';
      if (!timingSafeEqual(Buffer.from(record.digest),Buffer.from(hash(challenge+code)))) {
        const failures = (lock.failures || 0) + 1;
        tx.update(ref,{attempts:record.attempts+1});
        tx.set(lockRef,{ failures, locked: failures >= LOCK_LIMIT, updatedAt: new Date() },{ merge: true });
        return failures >= LOCK_LIMIT ? { newlyLocked: record.username } : { remaining: LOCK_LIMIT - failures };
      }
      const profile = await tx.get(db.doc('users/' + record.username));
      if (!profile.exists || profile.data().disabled || profile.data().id !== record.userId) return null;
      tx.delete(ref);
      tx.delete(lockRef);
      return { user: { ...profile.data(), username: profile.id } };
    });
    if (result === 'locked') throw lockedError();
    if (result?.newlyLocked) {
      await mailUnlock(db,result.newlyLocked,mail).catch(() => {});
      throw lockedError();
    }
    if (result?.remaining) fail(401,`인증번호가 틀렸습니다. ${result.remaining}번 더 틀리면 잠깁니다.`);
    const verified = result?.user;
    if (!verified) fail(401,'인증번호가 틀리거나 만료되었습니다. 다시 로그인해주세요.');
    return issueSession(db,verified,true);
  }
  if (path === '/api/auth/register' || path === '/api/auth/guest-login') {
    const guest = path.endsWith('guest-login');
    // Every required consent must be explicitly true; the agreed time is stamped by the server.
    const consent = body.consents || {};
    if (!CONSENT_ITEMS.every(item => consent[item] === true)) fail(400,'필수 약관에 모두 동의해주세요.');
    const username = guest ? 'guest_' + randomBytes(12).toString('hex') : usernameOf(body.username);
    const name = text(body.name), cell = guest ? '지인: ' + text(body.acquaintance_name) : text(body.cell_name);
    const now = new Date().toISOString();
    const user = { id: Date.now() * 1000 + randomInt(1000), username, name, cell_name:cell,
      role:guest?'guest':'member', is_guest:guest, cell_verified:guest?0:1, created_at:now,
      consent_version:CONSENT_VERSION, consent_items:CONSENT_ITEMS, consent_agreed_at:now };
    if (!guest && !body.is_acquaintance) {
      const cells = await db.collection('cells').get();
      const matched = findCell(cells.docs, cell);
      if (!matched) fail(400,'등록된 셀을 선택해주세요.');
      user.cell_name = matched.data().name;
    }
    // Acquaintance signups must name an existing, active member (guests do not count).
    if (!guest && body.is_acquaintance) {
      const members = await db.collection('users').where('name','==',cell).limit(20).get();
      if (!members.docs.some(doc => { const m = doc.data(); return !m.disabled && !m.is_guest && m.role !== 'guest'; })) fail(400,'등록된 성도 이름을 확인해주세요.');
    }
    await db.doc('users/' + username).create(user).catch(error => { if(error.code===6) fail(409,'이미 사용 중인 아이디입니다.'); throw error; });
    return issueSession(db,user);
  }
  fail(404,'요청을 찾을 수 없습니다.');
}
