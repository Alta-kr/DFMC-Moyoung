import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { db, dataDir, serverRoot } from '../db.js';
import { AuthRequest, authenticateToken, requireServerAdmin } from '../middleware/auth.js';


export const serverAdminRouter = Router();

// Apply auth & server_admin guard
serverAdminRouter.use(authenticateToken, requireServerAdmin);

// Helper to calculate directory size
function getFolderSize(folderPath: string): number {
  if (!fs.existsSync(folderPath)) return 0;
  let total = 0;
  const files = fs.readdirSync(folderPath);
  for (const file of files) {
    const filePath = path.join(folderPath, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      total += getFolderSize(filePath);
    } else {
      total += stat.size;
    }
  }
  return total;
}

// 1. Get Metrics (Traffic, Storage 1GB Gauge, Members, Security)
serverAdminRouter.get('/metrics', (req: AuthRequest, res: Response) => {
  // Traffic metrics
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const todayTraffic = db.prepare('SELECT COUNT(*) as count FROM traffic_logs WHERE timestamp >= ?').get(startOfDay) as { count: number };
  const totalTraffic = db.prepare('SELECT COUNT(*) as count FROM traffic_logs').get() as { count: number };

  // Total members
  const memberCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

  // Storage calculation (DB data folder + uploads folder)
  const dbSize = getFolderSize(dataDir);

  const uploadsDir = path.join(serverRoot, 'uploads');
  const uploadSize = getFolderSize(uploadsDir);


  const totalUsedBytes = dbSize + uploadSize;
  const storageLimitBytes = 1024 * 1024 * 1024; // 1 GB (1,073,741,824 bytes)

  // Security status
  const sec = db.prepare('SELECT fail_count, cooldown_until, is_locked FROM server_security WHERE id = 1').get() as any;

  res.json({
    traffic: {
      today: todayTraffic.count,
      total: totalTraffic.count,
    },
    storage: {
      used_bytes: totalUsedBytes,
      limit_bytes: storageLimitBytes,
      used_mb: (totalUsedBytes / (1024 * 1024)).toFixed(2),
      limit_mb: 1024,
      percentage: ((totalUsedBytes / storageLimitBytes) * 100).toFixed(3),
    },
    total_members: memberCount.count,
    security: {
      is_locked: !!sec.is_locked,
      fail_count: sec.fail_count,
      cooldown_until: sec.cooldown_until,
    },
  });
});

// 2. Get All Users (Sorted by Role: 전체 -> 미디어 -> 서버 -> 총무 -> 일반, then Name ASC)
serverAdminRouter.get('/users', (req: AuthRequest, res: Response) => {
  const users = db.prepare(`
    SELECT id, username, name, cell_name, role, cell_verified, created_at
    FROM users
  `).all() as any[];

  // Collect club managers (총무)
  const clubs = db.prepare('SELECT name, manager_names FROM clubs').all() as { name: string; manager_names: string }[];
  const managerMap = new Map<string, string[]>();
  clubs.forEach(c => {
    (c.manager_names || '').split(',').forEach(m => {
      const trimmed = m.trim();
      if (trimmed) {
        const list = managerMap.get(trimmed) || [];
        list.push(c.name);
        managerMap.set(trimmed, list);
      }
    });
  });

  const getRank = (u: any): number => {
    if (u.role === 'head_admin') return 1;    // 전체
    if (u.role === 'media_admin') return 2;   // 미디어
    if (u.role === 'server_admin') return 3;  // 서버
    if (managerMap.has(u.name)) return 4;     // 총무
    return 5;                                 // 일반
  };

  const enrichedUsers = users.map(u => ({
    ...u,
    is_leader: managerMap.has(u.name),
    leader_clubs: managerMap.get(u.name) || [],
  }));

  enrichedUsers.sort((a, b) => {
    const rankA = getRank(a);
    const rankB = getRank(b);
    if (rankA !== rankB) {
      return rankA - rankB;
    }
    return a.name.localeCompare(b.name, 'ko');
  });

  res.json({ users: enrichedUsers });
});

// 3. Assign / Dismiss Head Admin
serverAdminRouter.post('/set-role', (req: AuthRequest, res: Response) => {
  const { userId, role } = req.body;

  if (!userId || !role) {
    return res.status(400).json({ error: '사용자 ID와 역할을 지정해주세요.' });
  }

  if (role !== 'head_admin' && role !== 'media_admin' && role !== 'member') {
    return res.status(400).json({ error: '지정 가능한 역할은 전체 관리자(head_admin), 미디어관리자(media_admin) 또는 일반회원(member)입니다.' });
  }

  const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
  if (!targetUser) {
    return res.status(404).json({ error: '대상 사용자를 찾을 수 없습니다.' });
  }

  if (targetUser.role === 'server_admin') {
    return res.status(400).json({ error: '서버 관리자 계정의 역할은 변경할 수 없습니다.' });
  }

  if (role === 'head_admin' && targetUser.cell_name !== '둔산제일교회') {
    return res.status(400).json({ error: "소속이 '둔산제일교회'인 경우만 전체 관리자로 선택할 수 있습니다." });
  }

  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);

  const roleLabel = role === 'head_admin' ? '전체 관리자' : role === 'media_admin' ? '미디어관리자' : '일반회원';
  res.json({
    message: `${targetUser.name}님의 역할을 [${roleLabel}](으)로 설정하였습니다.`,
    user: { ...targetUser, role },
  });
});

// 4. Reset Security Lock (Direct Recovery)
serverAdminRouter.post('/reset-security', (req: AuthRequest, res: Response) => {
  db.prepare(`
    UPDATE server_security
    SET fail_count = 0, cooldown_until = 0, is_locked = 0, auth_code = NULL
    WHERE id = 1
  `).run();

  res.json({ message: '2FA 보안 잠금 및 쿨다운이 성공적으로 초기화되었습니다.' });
});
