import { Router, Request, Response } from 'express';
import { db } from '../db.js';
import { AuthRequest, authenticateToken } from '../middleware/auth.js';

export const lobbyRouter = Router();

// 1. Get Lobby Data (Public / Member)
lobbyRouter.get('/data', (req: Request, res: Response) => {
  // Notice
  const notice = db.prepare(`
    SELECT * FROM notices
    ORDER BY is_pinned DESC, id DESC
    LIMIT 1
  `).get();

  // Active Polls (dynamic from club_polls joined with clubs and votes)
  const dynamicPolls = db.prepare(`
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
  `).all();

  const polls = dynamicPolls.length > 0 ? dynamicPolls : db.prepare(`
    SELECT * FROM poll_highlights
    ORDER BY end_date ASC
  `).all();

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

  // Cell list for signup / cell update
  const cells = db.prepare('SELECT id, name FROM cells ORDER BY name ASC').all();

  // Welcome settings
  const welcomeSettings = db.prepare('SELECT welcome_tagline, welcome_message FROM lobby_settings WHERE id = 1').get() as any;

  res.json({
    notice,
    pollHighlight: polls[0] || null,
    polls,
    clubs,
    popup: activePopup,
    cells,
    welcome: welcomeSettings || {
      welcome_tagline: '은혜와 교제가 넘치는 둔산제일교회 모영',
      welcome_message: '이번 주에도 모영에서 기쁨의 교제 함께해요.',
    },
  });
});

// 2. Update Cell (When cell_verified is 0 after year-end reorganization)
lobbyRouter.post('/update-cell', authenticateToken, (req: AuthRequest, res: Response) => {
  const { cell_name } = req.body;
  if (!cell_name) {
    return res.status(400).json({ error: '새 소속 셀 이름을 입력해주세요.' });
  }

  const isCellRegistered = db.prepare('SELECT id FROM cells WHERE name = ?').get(cell_name.trim());
  const isMemberNameMatch = db.prepare('SELECT id FROM users WHERE name = ?').get(cell_name.trim());

  if (!isCellRegistered && !isMemberNameMatch) {
    return res.status(400).json({
      error: '등록된 공식 셀 명단이나 기존 성도 이름과 일치하지 않습니다. 교인 교차 확인이 필요합니다.',
    });
  }

  db.prepare('UPDATE users SET cell_name = ?, cell_verified = 1 WHERE id = ?').run(cell_name.trim(), req.user?.id);

  res.json({
    message: '소속 셀이 성공적으로 갱신되었습니다.',
    cell_name: cell_name.trim(),
  });
});
