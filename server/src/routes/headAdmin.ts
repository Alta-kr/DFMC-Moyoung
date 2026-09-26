import { Router, Response } from 'express';
import { db } from '../db.js';
import { AuthRequest, authenticateToken, requireAdmin, requireMediaOrAdmin } from '../middleware/auth.js';

export const headAdminRouter = Router();

// Apply base authentication token check
headAdminRouter.use(authenticateToken);

// ==========================================
// 1. Cell Reorganization Management (셀 개편 - 관리자 전용)
// ==========================================
headAdminRouter.get('/cells', requireAdmin, (req: AuthRequest, res: Response) => {
  db.prepare("INSERT OR IGNORE INTO cells (name) VALUES ('둔산제일교회')").run();

  const cells = db.prepare(`
    SELECT c.id, c.name, c.created_at,
           (SELECT COUNT(*) FROM users u WHERE u.cell_name = c.name) as member_count
    FROM cells c
    ORDER BY CASE WHEN c.name = '둔산제일교회' THEN 0 ELSE 1 END, c.id ASC
  `).all();

  res.json({ cells });
});

headAdminRouter.post('/cells', requireAdmin, (req: AuthRequest, res: Response) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '셀 이름을 입력해주세요.' });
  }

  try {
    const result = db.prepare('INSERT INTO cells (name) VALUES (?)').run(name.trim());
    res.json({
      message: `[${name.trim()}] 셀이 추가되었습니다.`,
      cell: { id: result.lastInsertRowid, name: name.trim(), member_count: 0 },
    });
  } catch (err: any) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '이미 존재하는 셀 이름입니다.' });
    }
    res.status(500).json({ error: '셀 추가 실패' });
  }
});

headAdminRouter.delete('/cells/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const target = db.prepare('SELECT * FROM cells WHERE id = ?').get(id) as any;
  if (!target) {
    return res.status(404).json({ error: '셀을 찾을 수 없습니다.' });
  }

  if (target.name === '둔산제일교회') {
    return res.status(400).json({ error: "'둔산제일교회'는 시스템 기본 고정 셀이므로 삭제할 수 없습니다." });
  }

  db.prepare('DELETE FROM cells WHERE id = ?').run(id);
  res.json({ message: `[${target.name}] 셀이 삭제되었습니다.` });
});

// Get members of a specific cell (소속 셀원 조회)
headAdminRouter.get('/cells/:id/members', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const target = db.prepare('SELECT * FROM cells WHERE id = ?').get(id) as any;
  if (!target) {
    return res.status(404).json({ error: '셀을 찾을 수 없습니다.' });
  }

  const cellMembers = db.prepare(`
    SELECT id, username, name, cell_name, role
    FROM users
    WHERE cell_name = ?
    ORDER BY name ASC
  `).all(target.name);

  res.json({ cell: target, members: cellMembers });
});

// Year-end batch cell reorganization (연말 일괄 셀 개편)
headAdminRouter.post('/cells/reorganize', requireAdmin, (req: AuthRequest, res: Response) => {
  const { cellNames } = req.body;

  // If cellNames array provided, update cells table
  if (Array.isArray(cellNames)) {
    db.transaction(() => {
      db.prepare('DELETE FROM cells').run();
      const insert = db.prepare('INSERT INTO cells (name) VALUES (?)');
      // Always insert '둔산제일교회' first as the permanent fixed cell
      insert.run('둔산제일교회');
      for (const cName of cellNames) {
        if (typeof cName === 'string' && cName.trim() && cName.trim() !== '둔산제일교회') {
          insert.run(cName.trim());
        }
      }
      // Require regular members to re-verify / select cell on next login
      db.prepare("UPDATE users SET cell_verified = 0 WHERE role = 'member'").run();
    })();
  } else {
    // Standard trigger without replacing cell list
    db.prepare("INSERT OR IGNORE INTO cells (name) VALUES ('둔산제일교회')").run();
    db.prepare("UPDATE users SET cell_verified = 0 WHERE role = 'member'").run();
  }

  const info = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'member'").get() as { count: number };
  const currentCells = db.prepare(`
    SELECT id, name FROM cells 
    ORDER BY CASE WHEN name = '둔산제일교회' THEN 0 ELSE 1 END, id ASC
  `).all();

  res.json({
    message: '새로운 셀 명단이 저장되었으며, 모든 일반 회원의 소속 셀 재설정이 요청되었습니다.',
    affectedCount: info.count,
    cells: currentCells,
  });
});

// Member list for Admin / Media Admin (Sorted: 전체 -> 미디어 -> 서버 -> 총무 -> 일반, then Name ASC)
headAdminRouter.get('/members', requireMediaOrAdmin, (req: AuthRequest, res: Response) => {
  const members = db.prepare(`
    SELECT id, username, name, cell_name, role
    FROM users
  `).all() as any[];

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
    if (u.role === 'head_admin') return 1;
    if (u.role === 'media_admin') return 2;
    if (u.role === 'server_admin') return 3;
    if (managerMap.has(u.name)) return 4;
    return 5;
  };

  const enriched = members.map(u => ({
    ...u,
    is_leader: managerMap.has(u.name),
    leader_clubs: managerMap.get(u.name) || [],
  }));

  enriched.sort((a, b) => {
    const rankA = getRank(a);
    const rankB = getRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name, 'ko');
  });

  res.json({ members: enriched });
});

// ==========================================
// 2. Popup Modal Management (팝업창 설정 - 미디어관리자/관리자)
// ==========================================
headAdminRouter.get('/popup', requireMediaOrAdmin, (req: AuthRequest, res: Response) => {
  const popup = db.prepare('SELECT * FROM popups ORDER BY id DESC LIMIT 1').get();
  res.json({ popup });
});

headAdminRouter.post('/popup', requireMediaOrAdmin, (req: AuthRequest, res: Response) => {
  const { title, content_text, image_url, end_date, is_active } = req.body;
  const safeTitle = (title && typeof title === 'string') ? title.trim() : '';
  const safeContent = (content_text && typeof content_text === 'string') ? content_text.trim() : '';
  const safeImageUrl = (image_url && typeof image_url === 'string') ? image_url.trim() : '';
  const safeEndDate = end_date || new Date(Date.now() + 365 * 86400000).toISOString();

  // Ensure only 1 active popup row exists or update existing
  const existing = db.prepare('SELECT id FROM popups ORDER BY id DESC LIMIT 1').get() as any;

  if (existing) {
    db.prepare(`
      UPDATE popups
      SET title = ?, content_text = ?, image_url = ?, end_date = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(safeTitle, safeContent, safeImageUrl, safeEndDate, is_active ? 1 : 0, existing.id);
  } else {
    db.prepare(`
      INSERT INTO popups (title, content_text, image_url, end_date, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(safeTitle, safeContent, safeImageUrl, safeEndDate, is_active ? 1 : 0);
  }

  const updated = db.prepare('SELECT * FROM popups ORDER BY id DESC LIMIT 1').get();
  res.json({ message: '팝업창 설정이 저장되었습니다.', popup: updated });
});

// ==========================================
// 3. Single Whole Notice (단일 전체 공지 관리 - 미디어관리자/관리자)
// ==========================================
headAdminRouter.get('/notices', requireMediaOrAdmin, (req: AuthRequest, res: Response) => {
  const notice = db.prepare('SELECT * FROM notices ORDER BY id DESC LIMIT 1').get();
  res.json({ notice });
});

headAdminRouter.post('/notices', requireMediaOrAdmin, (req: AuthRequest, res: Response) => {
  const { title, content } = req.body;
  const safeTitle = (title && typeof title === 'string') ? title.trim() : '';
  const safeContent = (content && typeof content === 'string') ? content.trim() : '';

  const authorName = req.user?.name || '전체 관리자';

  // Ensure exactly 1 notice exists by updating or replacing
  const existing = db.prepare('SELECT id FROM notices ORDER BY id DESC LIMIT 1').get() as any;
  if (existing) {
    db.prepare(`
      UPDATE notices
      SET title = ?, content = ?, author_id = ?, author_name = ?, created_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(safeTitle, safeContent, req.user?.id || 1, authorName, existing.id);
  } else {
    db.prepare(`
      INSERT INTO notices (title, content, author_id, author_name, is_pinned)
      VALUES (?, ?, ?, ?, 1)
    `).run(safeTitle, safeContent, req.user?.id || 1, authorName, 1);
  }

  const updated = db.prepare('SELECT * FROM notices ORDER BY id DESC LIMIT 1').get();
  res.json({
    message: '전체 공지가 저장되었습니다.',
    notice: updated,
  });
});

headAdminRouter.delete('/notices', requireMediaOrAdmin, (req: AuthRequest, res: Response) => {
  db.prepare('DELETE FROM notices').run();
  res.json({ message: '공지사항이 삭제되었습니다.' });
});

// ==========================================
// 4. Clubs & Managers Management (모영 및 총무 관리 - 관리자 전용)
// ==========================================
headAdminRouter.get('/clubs', requireAdmin, (req: AuthRequest, res: Response) => {
  const clubs = db.prepare('SELECT * FROM clubs ORDER BY id ASC').all();
  res.json({ clubs });
});

headAdminRouter.post('/clubs', requireAdmin, (req: AuthRequest, res: Response) => {
  const { name, icon, description, manager_names } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: '모영 이름을 입력해주세요.' });
  }

  // Validate maximum 3 managers
  const managers = (manager_names || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  if (managers.length > 3) {
    return res.status(400).json({ error: '총무는 모영당 최대 3명까지 선임할 수 있습니다.' });
  }

  const trimmedName = name.trim();
  const formattedName = trimmedName.endsWith('모영') ? trimmedName : `${trimmedName} 모영`;
  const defaultIcon = icon || '🎯';
  const descText = (description && description.trim()) ? description.trim() : `${formattedName} 활동 및 친교 모임`;

  const result = db.prepare(`
    INSERT INTO clubs (name, icon, description, manager_names, member_count)
    VALUES (?, ?, ?, ?, 0)
  `).run(formattedName, defaultIcon, descText, managers.join(', '));

  res.json({
    message: `[${formattedName}] 모영이 개설되었습니다.`,
    club: { id: result.lastInsertRowid, name: formattedName, icon: defaultIcon, description: descText, manager_names: managers.join(', '), member_count: 0 },
  });
});

headAdminRouter.delete('/clubs/:id', requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  db.prepare('DELETE FROM clubs WHERE id = ?').run(id);
  res.json({ message: '모영이 삭제되었습니다.' });
});

headAdminRouter.post('/clubs/:id/managers', requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { manager_names } = req.body;

  const managers = (manager_names || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  if (managers.length > 3) {
    return res.status(400).json({ error: '총무는 모영당 최대 3명까지 선임할 수 있습니다.' });
  }

  db.prepare('UPDATE clubs SET manager_names = ? WHERE id = ?').run(managers.join(', '), id);
  res.json({ message: '총무 명단이 업데이트되었습니다.' });
});

// ==========================================
// 5. Media Admin Management (미디어 관리자 선임/해임 - 관리자 전용)
// ==========================================
headAdminRouter.get('/media-admins', requireAdmin, (req: AuthRequest, res: Response) => {
  const mediaAdmins = db.prepare(`
    SELECT id, username, name, cell_name, role
    FROM users
    WHERE role = 'media_admin'
    ORDER BY name ASC
  `).all();
  res.json({ mediaAdmins });
});

headAdminRouter.post('/media-admins', requireAdmin, (req: AuthRequest, res: Response) => {
  const { userId, isMediaAdmin } = req.body;
  if (!userId) {
    return res.status(400).json({ error: '회원 ID가 필요합니다.' });
  }

  const target = db.prepare('SELECT id, name, role FROM users WHERE id = ?').get(userId) as any;
  if (!target) {
    return res.status(404).json({ error: '회원을 찾을 수 없습니다.' });
  }
  if (target.role === 'server_admin' || target.role === 'head_admin') {
    return res.status(400).json({ error: '서버관리자 또는 전체 관리자의 역할은 변경할 수 없습니다.' });
  }

  const newRole = isMediaAdmin ? 'media_admin' : 'member';
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(newRole, userId);

  res.json({
    message: isMediaAdmin ? `[${target.name}]님이 미디어 관리자로 선임되었습니다.` : `[${target.name}]님이 미디어 관리자에서 해임되었습니다.`,
    role: newRole,
  });
});

// ==========================================
// 6. Lobby Welcome Message Management (미디어관리자 / 전체관리자)
// ==========================================
headAdminRouter.get('/welcome', requireMediaOrAdmin, (req: AuthRequest, res: Response) => {
  const settings = db.prepare('SELECT welcome_tagline, welcome_message FROM lobby_settings WHERE id = 1').get() as any;
  res.json({
    welcome: settings || {
      welcome_tagline: '은혜와 교제가 넘치는 둔산제일교회 모영',
      welcome_message: '이번 주에도 모영에서 기쁨의 교제 함께해요.',
    },
  });
});

headAdminRouter.post('/welcome', requireMediaOrAdmin, (req: AuthRequest, res: Response) => {
  const { welcome_tagline, welcome_message } = req.body;
  const safeTagline = (welcome_tagline && typeof welcome_tagline === 'string') ? welcome_tagline.trim() : '';
  const safeMessage = (welcome_message && typeof welcome_message === 'string') ? welcome_message.trim() : '';

  db.prepare(`
    UPDATE lobby_settings
    SET welcome_tagline = ?, welcome_message = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(safeTagline, safeMessage);

  res.json({
    message: '로비 환영 문구가 성공적으로 저장되었습니다.',
    welcome: {
      welcome_tagline: safeTagline,
      welcome_message: safeMessage,
    },
  });
});

// ==========================================
// 7. Targeted Welcome Messages (대상별 맞춤 환영 문구)
// ==========================================
headAdminRouter.get('/targeted-welcomes', requireMediaOrAdmin, (req: AuthRequest, res: Response) => {
  const rows = db.prepare('SELECT * FROM targeted_welcome_messages ORDER BY id DESC').all() as any[];
  const allUsers = db.prepare('SELECT id, name, cell_name FROM users').all() as { id: number; name: string; cell_name: string }[];
  const userMap = new Map<number, { id: number; name: string; cell_name: string }>();
  allUsers.forEach(u => userMap.set(u.id, u));

  const targetedWelcomes = rows.map((r) => {
    let userIds: number[] = [];
    try {
      userIds = JSON.parse(r.user_ids || '[]');
    } catch {
      userIds = [];
    }

    const targetUsers = userIds
      .map((uid) => userMap.get(uid))
      .filter(Boolean);

    return {
      ...r,
      user_ids: userIds,
      target_users: targetUsers,
    };
  });

  res.json({ targetedWelcomes });
});

headAdminRouter.post('/targeted-welcomes', requireMediaOrAdmin, (req: AuthRequest, res: Response) => {
  const { id, group_name, welcome_tagline, welcome_message, user_ids, is_active } = req.body;

  if (!group_name || !group_name.trim()) {
    return res.status(400).json({ error: '대상 그룹명을 입력해주세요 (예: 말씀양육 수료자, 새가족 등록 성도 등).' });
  }

  const safeGroup = group_name.trim();
  const safeTagline = (welcome_tagline && typeof welcome_tagline === 'string') ? welcome_tagline.trim() : '';
  const safeMessage = (welcome_message && typeof welcome_message === 'string') ? welcome_message.trim() : '';
  const parsedUserIds = Array.isArray(user_ids) ? user_ids.map((u: any) => Number(u)).filter((n: number) => !isNaN(n)) : [];
  const activeFlag = is_active !== undefined ? (is_active ? 1 : 0) : 1;

  // Validate that no user is already assigned to another targeted welcome message (1 member = max 1 targeted welcome)
  const otherWelcomes = db.prepare(`
    SELECT id, group_name, user_ids FROM targeted_welcome_messages ${id ? 'WHERE id != ?' : ''}
  `).all(id ? [id] : []) as any[];

  const otherUserMap = new Map<number, string>();
  for (const ow of otherWelcomes) {
    try {
      const uids: number[] = JSON.parse(ow.user_ids || '[]');
      for (const uid of uids) {
        otherUserMap.set(uid, ow.group_name);
      }
    } catch {}
  }

  const conflicts = parsedUserIds.filter((uid: number) => otherUserMap.has(uid));
  if (conflicts.length > 0) {
    const firstConflictId = conflicts[0];
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(firstConflictId) as any;
    const conflictGroupName = otherUserMap.get(firstConflictId);
    const userName = user ? user.name : `성도 #${firstConflictId}`;
    return res.status(400).json({
      error: `[${userName}] 성도는 이미 '${conflictGroupName}' 맞춤 환영 문구에 포함되어 있습니다. (1인당 1개 문구만 지정 가능)`
    });
  }

  if (id) {
    // Update
    const existing = db.prepare('SELECT * FROM targeted_welcome_messages WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: '수정할 맞춤 환영 문구를 찾을 수 없습니다.' });
    }

    db.prepare(`
      UPDATE targeted_welcome_messages
      SET group_name = ?, welcome_tagline = ?, welcome_message = ?, user_ids = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(safeGroup, safeTagline, safeMessage, JSON.stringify(parsedUserIds), activeFlag, id);

    const updated = db.prepare('SELECT * FROM targeted_welcome_messages WHERE id = ?').get(id) as any;
    res.json({
      message: `[${safeGroup}] 맞춤 환영 문구가 수정되었습니다.`,
      item: {
        ...updated,
        user_ids: parsedUserIds,
      },
    });
  } else {
    // Create
    const result = db.prepare(`
      INSERT INTO targeted_welcome_messages (group_name, welcome_tagline, welcome_message, user_ids, is_active)
      VALUES (?, ?, ?, ?, ?)
    `).run(safeGroup, safeTagline, safeMessage, JSON.stringify(parsedUserIds), activeFlag);

    const created = db.prepare('SELECT * FROM targeted_welcome_messages WHERE id = ?').get(result.lastInsertRowid) as any;
    res.json({
      message: `[${safeGroup}] 맞춤 환영 문구가 등록되었습니다.`,
      item: {
        ...created,
        user_ids: parsedUserIds,
      },
    });
  }
});

headAdminRouter.post('/targeted-welcomes/:id/toggle', requireMediaOrAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const target = db.prepare('SELECT * FROM targeted_welcome_messages WHERE id = ?').get(id) as any;
  if (!target) {
    return res.status(404).json({ error: '맞춤 환영 문구를 찾을 수 없습니다.' });
  }

  const nextActive = target.is_active === 1 ? 0 : 1;
  db.prepare(`
    UPDATE targeted_welcome_messages
    SET is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nextActive, id);

  res.json({
    message: nextActive === 1 ? `[${target.group_name}] 맞춤 문구가 활성화되었습니다.` : `[${target.group_name}] 맞춤 문구가 비활성화되었습니다.`,
    is_active: nextActive,
  });
});

headAdminRouter.delete('/targeted-welcomes/:id', requireMediaOrAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const target = db.prepare('SELECT * FROM targeted_welcome_messages WHERE id = ?').get(id) as any;
  if (!target) {
    return res.status(404).json({ error: '삭제할 맞춤 환영 문구를 찾을 수 없습니다.' });
  }

  db.prepare('DELETE FROM targeted_welcome_messages WHERE id = ?').run(id);
  res.json({ message: `[${target.group_name}] 맞춤 환영 문구가 삭제되었습니다.` });
});


