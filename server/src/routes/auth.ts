import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { JWT_SECRET, AuthRequest, authenticateToken } from '../middleware/auth.js';
import { generateSecurityCode, send2FACodeEmail, sendIntrusionAlertEmail } from '../utils/mailer.js';

export const authRouter = Router();

function getLeaderClubs(name: string): string[] {
  try {
    const clubs = db.prepare('SELECT name, manager_names FROM clubs').all() as any[];
    const list: string[] = [];
    clubs.forEach(c => {
      const managers = (c.manager_names || '').split(',').map((s: string) => s.trim());
      if (managers.includes(name.trim())) {
        list.push(c.name);
      }
    });
    return list;
  } catch {
    return [];
  }
}

// 1. Register (No password needed: ID, Name, Cell or Acquaintance Name)
authRouter.post('/register', (req: Request, res: Response) => {
  const { username, name, cell_name, is_acquaintance } = req.body;

  if (!username || !name || !cell_name) {
    return res.status(400).json({ error: '아이디, 성도 실명, 소속 셀(또는 지인 성도 이름)을 모두 입력해주세요.' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
  if (existingUser) {
    return res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
  }

  // Strict Cell & Acquaintance Cross-Verification Rule:
  if (is_acquaintance) {
    // Must be a verified existing church member
    const memberMatch = db.prepare('SELECT id, name, cell_name FROM users WHERE name = ?').get(cell_name.trim()) as any;
    if (!memberMatch) {
      return res.status(400).json({
        error: `교인 명단에서 [${cell_name.trim()}] 성도를 찾을 수 없습니다. 현재 둔산제일교회에 등록된 지인의 실명을 정확히 입력해주세요.`,
      });
    }
  } else {
    // Must be a verified cell in registered cells list
    const isCellRegistered = db.prepare('SELECT id FROM cells WHERE name = ?').get(cell_name.trim());
    if (!isCellRegistered) {
      return res.status(400).json({
        error: `등록된 교회 셀 명단에 [${cell_name.trim()}] 셀이 존재하지 않습니다. 소속 셀 명을 정확히 입력하시거나, 소속 셀이 없으신 경우 [지인] 체크 후 지인 성도의 실명을 입력해주세요.`,
      });
    }
  }

  const memberMatch = is_acquaintance ? (db.prepare('SELECT name, cell_name FROM users WHERE name = ?').get(cell_name.trim()) as any) : null;
  const finalCellName = is_acquaintance && memberMatch ? `${memberMatch.cell_name} (지인: ${memberMatch.name})` : cell_name.trim();

  const result = db.prepare(`
    INSERT INTO users (username, password_hash, name, cell_name, role, cell_verified)
    VALUES (?, '', ?, ?, 'member', 1)
  `).run(username.trim(), name.trim(), finalCellName);

  const user = {
    id: result.lastInsertRowid as number,
    username: username.trim(),
    name: name.trim(),
    cell_name: finalCellName,
    role: 'member',
    cell_verified: 1,
  };

  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  res.json({ message: '회원가입이 완료되었습니다.', user, token });
});

// 2. Login (ID and Real Name only)
authRouter.post('/login', async (req: Request, res: Response) => {
  const { username, name } = req.body;

  if (!username || !name) {
    return res.status(400).json({ error: '아이디와 성도 실명을 모두 입력해주세요.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim()) as any;
  if (!user) {
    return res.status(400).json({ error: '등록되지 않은 아이디입니다.' });
  }

  // Verify Real Name
  if (user.name.trim() !== name.trim()) {
    return res.status(400).json({ error: '성도 실명이 등록된 정보와 일치하지 않습니다.' });
  }

  // Server Admin Flow (2FA verification still required for highest security)
  if (user.role === 'server_admin' || user.username === 'dfmc8470' || user.username === 'system') {
    const sec = db.prepare('SELECT * FROM server_security WHERE id = 1').get() as any;

    if (sec && sec.is_locked === 1) {
      return res.status(403).json({
        error: '🚨 [시스템 영구 잠금] 2FA 인증 5회 실패로 잠금 상태입니다. DB 직접 수정 또는 잠금 해제 스크립트 실행이 필요합니다.',
        is_locked: true,
      });
    }

    if (sec && sec.cooldown_until > Date.now()) {
      const remainingSeconds = Math.ceil((sec.cooldown_until - Date.now()) / 1000);
      return res.status(429).json({
        error: `인증 실패로 인해 대기 상태입니다. ${remainingSeconds}초 후 다시 시도하세요.`,
        cooldownSeconds: remainingSeconds,
      });
    }

    // Generate 5-character 2FA code
    const code = generateSecurityCode();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min
    const emailTarget = 'baehh4159@gmail.com';

    db.prepare(`
      UPDATE server_security
      SET auth_code = ?, code_expires_at = ?, last_attempt_at = ?
      WHERE id = 1
    `).run(code, expiresAt, Date.now());

    await send2FACodeEmail(emailTarget, code);

    return res.json({
      requires2FA: true,
      email: emailTarget,
      devCodeHint: code, // Convenient for local testing
      userId: user.id,
      message: `${emailTarget}으로 5자리 2단계 보안 코드가 발송되었습니다.`,
    });
  }

  // Regular Member & Head Admin Flow (Passwordless instant login)
  const leaderClubs = getLeaderClubs(user.name);
  const payload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    cell_name: user.cell_name,
    cell_verified: user.cell_verified,
    is_leader: leaderClubs.length > 0,
    leader_clubs: leaderClubs,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.json({ message: '로그인 성공', user: payload, token });
});

// 3. Verify 2FA (Server Admin)
authRouter.post('/verify-2fa', async (req: Request, res: Response) => {
  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: '5자리 인증코드를 입력해주세요.' });
  }

  const sec = db.prepare('SELECT * FROM server_security WHERE id = 1').get() as any;

  if (sec.is_locked === 1) {
    return res.status(403).json({
      error: '시스템이 영구 잠금 상태입니다. DB 직접 수정 후 해제할 수 있습니다.',
      is_locked: true,
    });
  }

  if (sec.cooldown_until > Date.now()) {
    const remainingSeconds = Math.ceil((sec.cooldown_until - Date.now()) / 1000);
    return res.status(429).json({
      error: `1분 쿨다운 대기 중입니다. ${remainingSeconds}초 후 다시 시도해주세요.`,
      cooldownSeconds: remainingSeconds,
    });
  }

  if (!sec.auth_code || sec.code_expires_at < Date.now()) {
    return res.status(400).json({ error: '인증코드가 만료되었거나 발급되지 않았습니다. 다시 로그인해주세요.' });
  }

  // Exact case-sensitive match
  if (sec.auth_code !== code.trim()) {
    const newFailCount = sec.fail_count + 1;
    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';

    if (newFailCount >= 5) {
      // Permanent lockout
      db.prepare(`
        UPDATE server_security
        SET fail_count = ?, is_locked = 1, auth_code = NULL
        WHERE id = 1
      `).run(newFailCount);

      await sendIntrusionAlertEmail('baehh4159@gmail.com', ip);

      return res.status(403).json({
        error: '🚨 2FA 인증을 5회 연속 실패하여 시스템이 영구 잠금 처리되었습니다. 보안 침입 감지 메일이 발송되었습니다.',
        is_locked: true,
        failCount: newFailCount,
      });
    } else {
      // 1 minute cooldown
      const cooldownUntil = Date.now() + 60 * 1000;
      db.prepare(`
        UPDATE server_security
        SET fail_count = ?, cooldown_until = ?
        WHERE id = 1
      `).run(newFailCount, cooldownUntil);

      return res.status(400).json({
        error: `인증코드가 일치하지 않습니다. (대소문자 구분)\n1회 실패 시 1분간 입력이 제한됩니다. (실패 ${newFailCount}/5회)`,
        cooldownSeconds: 60,
        failCount: newFailCount,
      });
    }
  }

  // Success
  db.prepare(`
    UPDATE server_security
    SET fail_count = 0, cooldown_until = 0, auth_code = NULL
    WHERE id = 1
  `).run();

  const adminUser = db.prepare("SELECT * FROM users WHERE role = 'server_admin' LIMIT 1").get() as any;
  const payload = {
    id: adminUser.id,
    username: adminUser.username,
    name: adminUser.name,
    role: adminUser.role,
    cell_name: adminUser.cell_name,
    cell_verified: adminUser.cell_verified,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.json({ message: '2단계 보안 인증 성공', user: payload, token });
});

// 4. Get Current User info
authRouter.get('/me', authenticateToken, (req: AuthRequest, res: Response) => {
  const user = db.prepare('SELECT id, username, name, cell_name, role, cell_verified, created_at FROM users WHERE id = ?').get(req.user?.id) as any;
  if (!user) {
    return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  }
  const leaderClubs = getLeaderClubs(user.name);
  res.json({
    user: {
      ...user,
      is_leader: leaderClubs.length > 0,
      leader_clubs: leaderClubs,
    }
  });
});

// 5. Quick Switch (Dev Helper)
authRouter.post('/quick-switch', (req: Request, res: Response) => {
  const { targetRole } = req.body; // 'server_admin', 'head_admin', 'media_admin', 'member'

  let targetUsername = 'member1';
  if (targetRole === 'server_admin') targetUsername = 'dfmc8470';
  else if (targetRole === 'head_admin') targetUsername = 'pastor';
  else if (targetRole === 'media_admin') {
    let ma = db.prepare("SELECT username FROM users WHERE role = 'media_admin' LIMIT 1").get() as any;
    if (!ma) {
      db.prepare("UPDATE users SET role = 'media_admin' WHERE username = 'user15'").run();
      targetUsername = 'user15';
    } else {
      targetUsername = ma.username;
    }
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(targetUsername) as any;
  if (!user) {
    return res.status(404).json({ error: '대상 계정을 찾을 수 없습니다.' });
  }

  const leaderClubs = getLeaderClubs(user.name);
  const payload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    cell_name: user.cell_name,
    cell_verified: user.cell_verified,
    is_leader: leaderClubs.length > 0,
    leader_clubs: leaderClubs,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  res.json({ message: `${user.name}(${user.role}) 계정으로 전환되었습니다.`, user: payload, token });
});

// 6. Security status check (public status for 2FA UI countdown)
authRouter.get('/security-status', (req: Request, res: Response) => {
  const sec = db.prepare('SELECT fail_count, cooldown_until, is_locked FROM server_security WHERE id = 1').get() as any;
  const remainingSeconds = sec.cooldown_until > Date.now() ? Math.ceil((sec.cooldown_until - Date.now()) / 1000) : 0;
  res.json({
    is_locked: !!sec.is_locked,
    fail_count: sec.fail_count,
    cooldown_seconds: remainingSeconds,
  });
});
