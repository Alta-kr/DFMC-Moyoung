import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { AuthRequest, authenticateToken, JWT_SECRET } from '../middleware/auth.js';


export const lobbyRouter = Router();

// 1. Get Lobby Data (Public / Member)
lobbyRouter.get('/data', (req: Request, res: Response) => {
  // Notice
  const notice = db.prepare(`
    SELECT * FROM notices
    ORDER BY is_pinned DESC, id DESC
    LIMIT 1
  `).get();

  // Auto-close expired polls in database and remove pin
  const nowIso = new Date().toISOString();
  const allOpenPolls = db.prepare('SELECT id, end_date FROM club_polls WHERE is_closed = 0').all() as any[];
  for (const p of allOpenPolls) {
    if (p.end_date && new Date(p.end_date).getTime() < Date.now()) {
      db.prepare('UPDATE club_polls SET is_closed = 1, is_pinned = 0 WHERE id = ?').run(p.id);
    }
  }

  // Active Polls (dynamic from club_polls joined with clubs and votes) - only unclosed & unexpired
  const dynamicPolls = (db.prepare(`
    SELECT 
      cp.id,
      cp.club_id,
      c.name as club_name,
      cp.title as poll_title,
      cp.end_date,
      (SELECT COUNT(*) FROM club_poll_votes cpv WHERE cpv.poll_id = cp.id) as voters_count
    FROM club_polls cp
    JOIN clubs c ON cp.club_id = c.id
    WHERE cp.is_closed = 0
    ORDER BY cp.end_date ASC
  `).all() as any[]).filter(p => !p.end_date || new Date(p.end_date).getTime() > Date.now());

  const fallbackPolls = (db.prepare(`
    SELECT * FROM poll_highlights
    ORDER BY end_date ASC
  `).all() as any[]).filter(p => !p.end_date || new Date(p.end_date).getTime() > Date.now());

  const polls = dynamicPolls.length > 0 ? dynamicPolls : fallbackPolls;

  // Clubs
  const clubs = db.prepare(`
    SELECT * FROM clubs
    ORDER BY id ASC
  `).all();

  // Active Popup (check is_active and end_date)
  const popup = db.prepare(`
    SELECT * FROM popups
    WHERE is_active = 1
    ORDER BY id DESC
    LIMIT 1
  `).get() as any;

  let activePopup = null;
  if (popup) {
    const isExpired = new Date(popup.end_date).getTime() < Date.now();
    if (!isExpired) {
      activePopup = popup;
    }
  }

  // Cell list for signup / cell update (Always ensure '둔산제일교회' is present)
  db.prepare("INSERT OR IGNORE INTO cells (name) VALUES ('둔산제일교회')").run();
  const cells = db.prepare(`
    SELECT id, name FROM cells 
    ORDER BY CASE WHEN name = '둔산제일교회' THEN 0 ELSE 1 END, name ASC
  `).all();

  // Welcome settings (General default)
  const welcomeSettings = db.prepare('SELECT welcome_tagline, welcome_message FROM lobby_settings WHERE id = 1').get() as any;

  // Check if authenticated user belongs to any active targeted welcome campaigns
  let targetedWelcome: any = null;
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      if (decoded && decoded.id) {
        const userId = Number(decoded.id);
        const activeTargeted = db.prepare(`
          SELECT group_name, welcome_tagline, welcome_message, user_ids
          FROM targeted_welcome_messages
          WHERE is_active = 1
          ORDER BY id DESC
        `).all() as any[];

        for (const row of activeTargeted) {
          try {
            const uids: number[] = JSON.parse(row.user_ids || '[]');
            if (uids.includes(userId)) {
              targetedWelcome = {
                welcome_tagline: row.welcome_tagline,
                welcome_message: row.welcome_message,
                group_name: row.group_name,
                is_targeted: true,
              };
              break;
            }
          } catch {
            // ignore JSON error
          }
        }
      }
    } catch {
      // token invalid or expired, fallback to general welcome
    }
  }

  const finalWelcome = targetedWelcome || {
    welcome_tagline: welcomeSettings?.welcome_tagline ?? '은혜와 교제가 넘치는 둔산제일교회 모영',
    welcome_message: welcomeSettings?.welcome_message ?? '이번 주에도 모영에서 기쁨의 교제 함께해요.',
    group_name: undefined,
    is_targeted: false,
  };

  res.json({
    notice,
    pollHighlight: polls[0] || null,
    polls,
    clubs,
    popup: activePopup,
    cells,
    welcome: finalWelcome,
  });
});

// 2. Update Cell (수기 작성 지원 & leader_clubs 동기화)
lobbyRouter.post('/update-cell', authenticateToken, (req: AuthRequest, res: Response) => {
  const { cell_name } = req.body;
  if (!cell_name || !cell_name.trim()) {
    return res.status(400).json({ error: '새 소속 셀 이름을 입력해주세요.' });
  }

  const cleanCellName = cell_name.trim();
  const noSpaceInput = cleanCellName.replace(/\s+/g, '');

  // Verify cell exists in registered cells without leaking full list
  const matchedCell = db.prepare(`
    SELECT id, name FROM cells 
    WHERE REPLACE(name, ' ', '') = ?
    LIMIT 1
  `).get(noSpaceInput) as any;

  if (!matchedCell) {
    return res.status(400).json({
      error: `입력하신 [${cleanCellName}]은(는) 교회에 등록된 셀 명단과 일치하지 않습니다. 정확한 소속 셀 명칭을 직접 작성해주세요.`,
    });
  }

  const finalCellName = matchedCell.name;
  db.prepare('UPDATE users SET cell_name = ?, cell_verified = 1 WHERE id = ?').run(finalCellName, req.user?.id);

  const updatedUser = db.prepare('SELECT id, username, name, role, cell_name, cell_verified FROM users WHERE id = ?').get(req.user?.id) as any;

  // Calculate leader_clubs
  const clubs = db.prepare('SELECT name, manager_names FROM clubs').all() as any[];
  const leaderClubs: string[] = [];
  clubs.forEach(c => {
    const managers = (c.manager_names || '').split(',').map((s: string) => s.trim());
    if (managers.includes(updatedUser.name.trim())) {
      leaderClubs.push(c.name);
    }
  });

  const payload = {
    ...updatedUser,
    is_leader: leaderClubs.length > 0,
    leader_clubs: leaderClubs,
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

  res.json({
    message: '소속 셀이 성공적으로 저장되었습니다.',
    cell_name: cleanCellName,
    user: payload,
    token,
  });
});

