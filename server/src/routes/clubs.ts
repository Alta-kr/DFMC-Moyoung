import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { db, serverRoot } from '../db.js';
import { AuthRequest, authenticateToken } from '../middleware/auth.js';

export const clubsRouter = Router();

// Multer Storage Setup for file explorer uploads
const uploadDir = path.join(serverRoot, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueName = `post_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('이미지 파일만 업로드할 수 있습니다.'));
    }
  },
});

// All routes require user authentication
clubsRouter.use(authenticateToken);

// 0. Upload image from file explorer
clubsRouter.post('/upload-image', upload.single('image'), (req: AuthRequest, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: '업로드할 이미지 파일을 선택해주세요.' });
  }
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ url: imageUrl, filename: req.file.filename });
});

// Helper: check if user is manager of club or head_admin/server_admin
function checkIsClubManager(club: any, user: any): boolean {
  if (!club || !user) return false;
  if (user.role === 'head_admin' || user.role === 'server_admin') return true;
  const managers = (club.manager_names || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  return managers.includes(user.name);
}

// 1. Get Club Details (Info, Polls, Posts, Schedules, Photos)
clubsRouter.get('/:id', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const user = req.user;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!club) {
    return res.status(404).json({ error: '존재하지 않는 모영입니다.' });
  }

  const isManager = checkIsClubManager(club, user);

  // Auto-close expired polls in database and remove pin
  const rawOpenPolls = db.prepare('SELECT id, end_date FROM club_polls WHERE club_id = ? AND is_closed = 0').all(clubId) as any[];
  for (const op of rawOpenPolls) {
    if (op.end_date && new Date(op.end_date).getTime() < Date.now()) {
      db.prepare('UPDATE club_polls SET is_closed = 1, is_pinned = 0 WHERE id = ?').run(op.id);
    }
  }

  // Polls
  const rawPolls = db.prepare(`
    SELECT * FROM club_polls
    WHERE club_id = ?
    ORDER BY is_pinned DESC, is_closed ASC, end_date ASC
  `).all(clubId) as any[];

  const polls = rawPolls.map((p) => {
    let parsedOptions: string[] = [];
    try {
      parsedOptions = JSON.parse(p.options || '[]');
    } catch {
      parsedOptions = [];
    }

    // Get votes for this poll
    const votes = db.prepare('SELECT user_id, user_name, selected_option FROM club_poll_votes WHERE poll_id = ?').all(p.id) as any[];
    
    // User's own vote
    const userVote = votes.find((v) => v.user_id === user?.id);

    // Option counts
    const optionCounts: Record<string, number> = {};
    parsedOptions.forEach((opt) => { optionCounts[opt] = 0; });
    votes.forEach((v) => {
      if (optionCounts[v.selected_option] !== undefined) {
        optionCounts[v.selected_option]++;
      }
    });

    const isExpired = p.end_date ? new Date(p.end_date).getTime() < Date.now() : false;
    const isClosed = p.is_closed === 1 || isExpired;

    const rawComments = db.prepare(`
      SELECT * FROM club_post_comments
      WHERE poll_id = ?
      ORDER BY created_at ASC
    `).all(p.id) as any[];

    return {
      ...p,
      options: parsedOptions,
      total_votes: votes.length,
      option_counts: optionCounts,
      my_vote: userVote ? userVote.selected_option : null,
      is_expired: isExpired,
      is_closed: isClosed ? 1 : 0,
      is_pinned: isClosed ? 0 : p.is_pinned,
      comments: rawComments,
    };
  });

  // Posts (Community Feed with comments & reactions)
  const rawPosts = db.prepare(`
    SELECT * FROM club_posts
    WHERE club_id = ?
    ORDER BY is_pinned DESC, created_at DESC
    LIMIT 500
  `).all(clubId) as any[];

  const posts = rawPosts.map((post) => {
    const rawComments = db.prepare(`
      SELECT * FROM club_post_comments
      WHERE post_id = ? AND (schedule_id IS NULL OR schedule_id = 0)
      ORDER BY created_at ASC
    `).all(post.id) as any[];

    const comments = rawComments.map((c) => {
      const cReactionsRaw = db.prepare(`
        SELECT emoji, COUNT(*) as count FROM club_reactions
        WHERE target_type = 'comment' AND target_id = ?
        GROUP BY emoji
      `).all(c.id) as any[];
      const cReactions: Record<string, number> = { amen: 0, heart: 0, like: 0, fire: 0, smile: 0 };
      cReactionsRaw.forEach((r) => { cReactions[r.emoji] = r.count; });
      const myCReactions = db.prepare(`
        SELECT emoji FROM club_reactions
        WHERE target_type = 'comment' AND target_id = ? AND user_id = ?
      `).all(c.id, user?.id).map((r: any) => r.emoji);
      return {
        ...c,
        reactions: cReactions,
        my_reactions: myCReactions,
      };
    });

    const rawReactions = db.prepare(`
      SELECT emoji, COUNT(*) as count FROM club_reactions
      WHERE target_type = 'post' AND target_id = ?
      GROUP BY emoji
    `).all(post.id) as any[];

    const reactions: Record<string, number> = { amen: 0, heart: 0, like: 0, fire: 0, smile: 0 };
    rawReactions.forEach((r) => { reactions[r.emoji] = r.count; });

    const myReactions = db.prepare(`
      SELECT emoji FROM club_reactions
      WHERE target_type = 'post' AND target_id = ? AND user_id = ?
    `).all(post.id, user?.id).map((r: any) => r.emoji);

    return {
      ...post,
      comments,
      reactions,
      my_reactions: myReactions,
    };
  });

  // Schedules (Gatherings with comments & reactions)
  const rawSchedules = db.prepare(`
    SELECT * FROM club_schedules
    WHERE club_id = ?
    ORDER BY is_pinned DESC, event_date ASC
  `).all(clubId) as any[];

  const schedules = rawSchedules.map((s) => {
    let attendees: any[] = [];
    try {
      attendees = JSON.parse(s.attendees || '[]');
    } catch {
      attendees = [];
    }
    const isAttending = attendees.some((a) => a.userId === user?.id);

    const rawComments = db.prepare(`
      SELECT * FROM club_post_comments
      WHERE schedule_id = ?
      ORDER BY created_at ASC
    `).all(s.id) as any[];

    const comments = rawComments.map((c) => {
      const cReactionsRaw = db.prepare(`
        SELECT emoji, COUNT(*) as count FROM club_reactions
        WHERE target_type = 'comment' AND target_id = ?
        GROUP BY emoji
      `).all(c.id) as any[];
      const cReactions: Record<string, number> = { amen: 0, heart: 0, like: 0, fire: 0, smile: 0 };
      cReactionsRaw.forEach((r) => { cReactions[r.emoji] = r.count; });
      const myCReactions = db.prepare(`
        SELECT emoji FROM club_reactions
        WHERE target_type = 'comment' AND target_id = ? AND user_id = ?
      `).all(c.id, user?.id).map((r: any) => r.emoji);
      return {
        ...c,
        reactions: cReactions,
        my_reactions: myCReactions,
      };
    });

    const rawReactions = db.prepare(`
      SELECT emoji, COUNT(*) as count FROM club_reactions
      WHERE target_type = 'schedule' AND target_id = ?
      GROUP BY emoji
    `).all(s.id) as any[];

    const reactions: Record<string, number> = { amen: 0, heart: 0, like: 0, fire: 0, smile: 0 };
    rawReactions.forEach((r) => { reactions[r.emoji] = r.count; });

    const myReactions = db.prepare(`
      SELECT emoji FROM club_reactions
      WHERE target_type = 'schedule' AND target_id = ? AND user_id = ?
    `).all(s.id, user?.id).map((r: any) => r.emoji);

    return {
      ...s,
      attendees,
      is_attending: isAttending,
      comments,
      reactions,
      my_reactions: myReactions,
    };
  });

  // Photos (Gallery)
  const photos = db.prepare(`
    SELECT * FROM club_photos
    WHERE club_id = ?
    ORDER BY created_at DESC
    LIMIT 40
  `).all(clubId);

  // Manager handover votes (for this club)
  const rawHandoverVotes = db.prepare(`
    SELECT * FROM club_manager_handover_votes
    WHERE club_id = ? AND status = 'pending'
    ORDER BY created_at DESC
  `).all(clubId) as any[];

  const handoverVotes = rawHandoverVotes.map((v) => {
    let agreedIds: number[] = [];
    try {
      agreedIds = JSON.parse(v.agreed_user_ids || '[]');
    } catch {
      agreedIds = [];
    }
    return {
      ...v,
      agreed_user_ids: agreedIds,
      has_agreed: agreedIds.includes(user?.id || 0),
    };
  });

  // Church members for handover modal
  const churchMembers = db.prepare('SELECT id, name, cell_name FROM users ORDER BY name ASC').all();

  res.json({
    club,
    isManager,
    polls,
    posts,
    schedules,
    photos,
    handoverVotes,
    churchMembers,
  });
});

// 2. Update Club Name and Description (Managers or Head Admin only)
clubsRouter.post('/:id/info', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const user = req.user;
  const { name, description, icon } = req.body;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!club) return res.status(404).json({ error: '모영을 찾을 수 없습니다.' });

  if (user?.role !== 'head_admin' && user?.role !== 'server_admin') {
    return res.status(403).json({ error: '모영 이름 수정은 전체 관리자만 가능합니다.' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: '모영 이름을 입력해주세요.' });
  }

  const formattedName = name.trim().endsWith('모영') ? name.trim() : `${name.trim()} 모영`;

  db.prepare(`
    UPDATE clubs
    SET name = ?, description = ?, icon = ?
    WHERE id = ?
  `).run(formattedName, description ? description.trim() : '', icon || club.icon, clubId);

  const updated = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId);
  res.json({ message: '모영 정보가 성공적으로 수정되었습니다.', club: updated });
});

// 3. Create Poll (Managers or Head Admin only)
clubsRouter.post('/:id/polls', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const user = req.user;
  const { title, description, options, end_date } = req.body;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!club) return res.status(404).json({ error: '모영을 찾을 수 없습니다.' });

  if (!checkIsClubManager(club, user)) {
    return res.status(403).json({ error: '투표 개설은 모영 총무 또는 전체 관리자만 가능합니다.' });
  }

  if (!title || !title.trim()) {
    return res.status(400).json({ error: '투표 제목을 입력해주세요.' });
  }
  if (!Array.isArray(options) || options.filter((o: string) => o && o.trim()).length < 2) {
    return res.status(400).json({ error: '선택지는 최소 2개 이상 입력해야 합니다.' });
  }
  if (!end_date) {
    return res.status(400).json({ error: '투표 마감 일시를 설정해주세요.' });
  }

  const cleanOptions = options.map((o: string) => o.trim()).filter(Boolean);

  const result = db.prepare(`
    INSERT INTO club_polls (club_id, title, description, options, end_date, is_closed, creator_id, creator_name)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    clubId,
    title.trim(),
    description ? description.trim() : '',
    JSON.stringify(cleanOptions),
    end_date,
    user?.id,
    user?.name
  );

  // Sync to poll_highlights for lobby
  db.prepare(`
    INSERT INTO poll_highlights (club_id, club_name, poll_title, end_date, voters_count, total_members)
    VALUES (?, ?, ?, ?, 0, 0)
  `).run(clubId, club.name, title.trim(), end_date);

  res.json({ message: '신규 투표가 성공적으로 개설되었습니다.', pollId: result.lastInsertRowid });
});

// 4. Vote or Change Vote (Any member)
clubsRouter.post('/:id/polls/:pollId/vote', (req: AuthRequest, res: Response) => {
  const pollId = parseInt(req.params.pollId);
  const user = req.user;
  const { selected_option } = req.body;

  if (!selected_option) {
    return res.status(400).json({ error: '선택지를 선택해주세요.' });
  }

  const poll = db.prepare('SELECT * FROM club_polls WHERE id = ?').get(pollId) as any;
  if (!poll) return res.status(404).json({ error: '투표를 찾을 수 없습니다.' });

  if (poll.is_closed || new Date(poll.end_date).getTime() < Date.now()) {
    return res.status(400).json({ error: '이미 마감된 투표입니다.' });
  }

  let options: string[] = [];
  try {
    options = JSON.parse(poll.options);
  } catch {
    options = [];
  }

  if (!options.includes(selected_option)) {
    return res.status(400).json({ error: '유효한 선택지가 아닙니다.' });
  }

  db.prepare(`
    INSERT OR REPLACE INTO club_poll_votes (poll_id, user_id, user_name, selected_option, voted_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
  `).run(pollId, user?.id, user?.name, selected_option);

  // Update voters_count in poll_highlights if applicable
  const totalCount = db.prepare('SELECT COUNT(*) as count FROM club_poll_votes WHERE poll_id = ?').get(pollId) as { count: number };
  db.prepare('UPDATE poll_highlights SET voters_count = ? WHERE poll_title = ?').run(totalCount.count, poll.title);

  res.json({ message: `[${selected_option}] 투표가 반영되었습니다.`, selectedOption: selected_option });
});

// 5. Close Poll (Managers or Head Admin) - supports both PUT and POST
const handleClosePollRequest = (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const pollId = parseInt(req.params.pollId);
  const user = req.user;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!checkIsClubManager(club, user)) {
    return res.status(403).json({ error: '투표 마감은 총무 또는 전체 관리자만 가능합니다.' });
  }

  // Close poll and remove pin immediately
  db.prepare('UPDATE club_polls SET is_closed = 1, is_pinned = 0 WHERE id = ? AND club_id = ?').run(pollId, clubId);
  res.json({ message: '투표가 마감 처리되었습니다. (피드 상단 고정이 해제되었습니다)' });
};

clubsRouter.put('/:id/polls/:pollId/close', handleClosePollRequest);
clubsRouter.post('/:id/polls/:pollId/close', handleClosePollRequest);

// 6. Delete Poll (Managers or Head Admin)
clubsRouter.delete('/:id/polls/:pollId', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const pollId = parseInt(req.params.pollId);
  const user = req.user;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!checkIsClubManager(club, user)) {
    return res.status(403).json({ error: '투표 삭제는 총무 또는 전체 관리자만 가능합니다.' });
  }

  db.prepare('DELETE FROM club_polls WHERE id = ? AND club_id = ?').run(pollId, clubId);
  db.prepare('DELETE FROM club_poll_votes WHERE poll_id = ?').run(pollId);
  res.json({ message: '투표가 삭제되었습니다.' });
});

// 6-1. Toggle Pin Poll (Managers or Head Admin)
clubsRouter.put('/:id/polls/:pollId/pin', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const pollId = parseInt(req.params.pollId);
  const user = req.user;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!checkIsClubManager(club, user)) {
    return res.status(403).json({ error: '투표 상단 고정 권한은 총무 또는 전체 관리자만 가능합니다.' });
  }

  const poll = db.prepare('SELECT id, is_pinned FROM club_polls WHERE id = ? AND club_id = ?').get(pollId, clubId) as any;
  if (!poll) return res.status(404).json({ error: '투표를 찾을 수 없습니다.' });

  const newPinned = poll.is_pinned === 1 ? 0 : 1;
  db.prepare('UPDATE club_polls SET is_pinned = ? WHERE id = ?').run(newPinned, pollId);

  res.json({
    message: newPinned === 1 ? '투표가 피드 상단에 고정되었습니다.' : '투표 상단 고정이 해제되었습니다.',
    is_pinned: newPinned,
  });
});

// 7. Community Feed Posts (총무 전용)
clubsRouter.post('/:id/posts', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const user = req.user;
  const { content, image_url } = req.body;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!club) return res.status(404).json({ error: '모영을 찾을 수 없습니다.' });

  if (!checkIsClubManager(club, user)) {
    return res.status(403).json({ error: '모영 피드 작성은 총무 또는 관리자만 가능합니다.' });
  }

  const trimmedContent = (content || '').trim();
  const trimmedImage = (image_url || '').trim();

  if (!trimmedContent && !trimmedImage) {
    return res.status(400).json({ error: '내용 또는 사진을 입력해주세요.' });
  }

  const result = db.prepare(`
    INSERT INTO club_posts (club_id, user_id, user_name, user_cell, content, image_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(clubId, user?.id, user?.name, user?.cell_name || '둔산제일교회', trimmedContent, trimmedImage || null);

  const newPost = db.prepare('SELECT * FROM club_posts WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '나눔 글이 등록되었습니다.', post: newPost });
});

// 7-1. Edit Post (Author only, or Head Admin)
clubsRouter.put('/:id/posts/:postId', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const postId = parseInt(req.params.postId);
  const user = req.user;
  const { content, image_url } = req.body;

  const post = db.prepare('SELECT * FROM club_posts WHERE id = ? AND club_id = ?').get(postId, clubId) as any;
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

  const isAuthor = post.user_id === user?.id;
  const isAdmin = user?.role === 'head_admin' || user?.role === 'server_admin';

  if (!isAuthor && !isAdmin) {
    return res.status(403).json({ error: '자신이 작성한 글만 수정할 수 있습니다.' });
  }

  const trimmedContent = (content || '').trim();
  const finalImage = image_url !== undefined ? (image_url ? image_url.trim() : null) : post.image_url;

  if (!trimmedContent && !finalImage) {
    return res.status(400).json({ error: '수정할 내용이나 사진이 있어야 합니다.' });
  }

  db.prepare(`
    UPDATE club_posts
    SET content = ?, image_url = ?
    WHERE id = ?
  `).run(trimmedContent, finalImage, postId);

  const updated = db.prepare('SELECT * FROM club_posts WHERE id = ?').get(postId);
  res.json({ message: '글이 성공적으로 수정되었습니다.', post: updated });
});

// 7-2. Delete Post (Media Admin & Head Admin ONLY)
clubsRouter.delete('/:id/posts/:postId', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const postId = parseInt(req.params.postId);
  const user = req.user;

  const post = db.prepare('SELECT * FROM club_posts WHERE id = ? AND club_id = ?').get(postId, clubId) as any;
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

  // Only Media Admin and Head/Server Admin can delete thread posts
  const canDelete = user?.role === 'media_admin' || user?.role === 'head_admin' || user?.role === 'server_admin';

  if (!canDelete) {
    return res.status(403).json({ error: '쓰레드 글 삭제는 미디어 관리자 또는 전체 관리자만 가능합니다.' });
  }

  db.prepare('DELETE FROM club_posts WHERE id = ?').run(postId);
  db.prepare('DELETE FROM club_post_comments WHERE post_id = ?').run(postId);
  db.prepare("DELETE FROM club_reactions WHERE target_type = 'post' AND target_id = ?").run(postId);
  res.json({ message: '글이 삭제되었습니다.' });
});

// 7-3. Toggle Pin Post (Managers or Head Admin)
clubsRouter.put('/:id/posts/:postId/pin', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const postId = parseInt(req.params.postId);
  const user = req.user;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!checkIsClubManager(club, user)) {
    return res.status(403).json({ error: '피드 상단 고정 권한은 총무 또는 전체 관리자만 가능합니다.' });
  }

  const post = db.prepare('SELECT id, is_pinned FROM club_posts WHERE id = ? AND club_id = ?').get(postId, clubId) as any;
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

  const newPinned = post.is_pinned === 1 ? 0 : 1;
  db.prepare('UPDATE club_posts SET is_pinned = ? WHERE id = ?').run(newPinned, postId);

  res.json({
    message: newPinned === 1 ? '게시글이 피드 상단에 고정되었습니다.' : '게시글 상단 고정이 해제되었습니다.',
    is_pinned: newPinned,
  });
});

// 8. Schedules (Gatherings & Attendance)
clubsRouter.post('/:id/schedules', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const user = req.user;
  const { title, event_date, location, fee_info } = req.body;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!checkIsClubManager(club, user)) {
    return res.status(403).json({ error: '일정 등록은 총무 또는 전체 관리자만 가능합니다.' });
  }

  if (!title || !event_date || !location) {
    return res.status(400).json({ error: '모임명, 일시, 장소를 모두 입력해주세요.' });
  }

  // Initial attendee is the creator
  const initialAttendees = [{ userId: user?.id, userName: user?.name, cellName: user?.cell_name }];

  const result = db.prepare(`
    INSERT INTO club_schedules (club_id, title, event_date, location, fee_info, attendees, creator_name)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(clubId, title.trim(), event_date.trim(), location.trim(), fee_info || '무료', JSON.stringify(initialAttendees), user?.name);

  res.json({ message: '모임 일정이 성공적으로 등록되었습니다.', scheduleId: result.lastInsertRowid });
});

clubsRouter.delete('/:id/schedules/:scheduleId', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const scheduleId = parseInt(req.params.scheduleId);
  const user = req.user;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!checkIsClubManager(club, user)) {
    return res.status(403).json({ error: '일정 삭제는 총무 또는 전체 관리자만 가능합니다.' });
  }

  db.prepare('DELETE FROM club_schedules WHERE id = ? AND club_id = ?').run(scheduleId, clubId);
  db.prepare('DELETE FROM club_post_comments WHERE schedule_id = ?').run(scheduleId);
  db.prepare("DELETE FROM club_reactions WHERE target_type = 'schedule' AND target_id = ?").run(scheduleId);
  res.json({ message: '일정이 삭제되었습니다.' });
});

// 8-1. Toggle Pin Schedule (Managers or Head Admin)
clubsRouter.put('/:id/schedules/:scheduleId/pin', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const scheduleId = parseInt(req.params.scheduleId);
  const user = req.user;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!checkIsClubManager(club, user)) {
    return res.status(403).json({ error: '일정 상단 고정 권한은 총무 또는 전체 관리자만 가능합니다.' });
  }

  const schedule = db.prepare('SELECT id, is_pinned FROM club_schedules WHERE id = ? AND club_id = ?').get(scheduleId, clubId) as any;
  if (!schedule) return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });

  const newPinned = schedule.is_pinned === 1 ? 0 : 1;
  db.prepare('UPDATE club_schedules SET is_pinned = ? WHERE id = ?').run(newPinned, scheduleId);

  res.json({
    message: newPinned === 1 ? '일정이 피드 상단에 고정되었습니다.' : '일정 상단 고정이 해제되었습니다.',
    is_pinned: newPinned,
  });
});

// Toggle Attendance for Schedule
clubsRouter.post('/:id/schedules/:scheduleId/attend', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const scheduleId = parseInt(req.params.scheduleId);
  const user = req.user;

  const schedule = db.prepare('SELECT * FROM club_schedules WHERE id = ? AND club_id = ?').get(scheduleId, clubId) as any;
  if (!schedule) return res.status(404).json({ error: '일정을 찾을 수 없습니다.' });

  let attendees: any[] = [];
  try {
    attendees = JSON.parse(schedule.attendees || '[]');
  } catch {
    attendees = [];
  }

  const existingIdx = attendees.findIndex((a) => a.userId === user?.id);
  let isAttending = false;

  if (existingIdx >= 0) {
    // Cancel attendance
    attendees.splice(existingIdx, 1);
    isAttending = false;
  } else {
    // Add attendance
    attendees.push({
      userId: user?.id,
      userName: user?.name,
      cellName: user?.cell_name || '둔산제일교회',
    });
    isAttending = true;
  }

  db.prepare('UPDATE club_schedules SET attendees = ? WHERE id = ?').run(JSON.stringify(attendees), scheduleId);

  res.json({
    message: isAttending ? '모임 참석이 신청되었습니다! 🙋‍♂️' : '모임 참석이 취소되었습니다.',
    isAttending,
    attendees,
  });
});

// 9. Photos (Gallery - 총무 전용)
clubsRouter.post('/:id/photos', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const user = req.user;
  const { image_url, caption } = req.body;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!club) return res.status(404).json({ error: '모영을 찾을 수 없습니다.' });

  if (!checkIsClubManager(club, user)) {
    return res.status(403).json({ error: '사진 등록은 총무 또는 관리자만 가능합니다.' });
  }

  if (!image_url || !image_url.trim()) {
    return res.status(400).json({ error: '이미지 URL을 입력해주세요.' });
  }

  const result = db.prepare(`
    INSERT INTO club_photos (club_id, user_id, user_name, image_url, caption)
    VALUES (?, ?, ?, ?, ?)
  `).run(clubId, user?.id, user?.name, image_url.trim(), caption ? caption.trim() : '');

  const newPhoto = db.prepare('SELECT * FROM club_photos WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '사진이 앨범에 등록되었습니다.', photo: newPhoto });
});

clubsRouter.delete('/:id/photos/:photoId', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const photoId = parseInt(req.params.photoId);
  const user = req.user;

  const photo = db.prepare('SELECT * FROM club_photos WHERE id = ? AND club_id = ?').get(photoId, clubId) as any;
  if (!photo) return res.status(404).json({ error: '사진을 찾을 수 없습니다.' });

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  const isManager = checkIsClubManager(club, user);

  if (photo.user_id !== user?.id && !isManager) {
    return res.status(403).json({ error: '등록자 본인 또는 총무만 삭제할 수 있습니다.' });
  }

  db.prepare('DELETE FROM club_photos WHERE id = ?').run(photoId);
  res.json({ message: '사진이 삭제되었습니다.' });
});

// 10. Comments & Replies
clubsRouter.post('/:id/posts/:postId/comments', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const postId = parseInt(req.params.postId);
  const user = req.user;
  const { content, parent_comment_id } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
  }

  // Verify post belongs to club
  const post = db.prepare('SELECT id FROM club_posts WHERE id = ? AND club_id = ?').get(postId, clubId);
  if (!post) {
    return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });
  }

  const result = db.prepare(`
    INSERT INTO club_post_comments (post_id, parent_comment_id, user_id, user_name, user_cell, content)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    postId,
    parent_comment_id ? parseInt(parent_comment_id) : null,
    user?.id,
    user?.name,
    user?.cell_name,
    content.trim()
  );

  const newComment = db.prepare('SELECT * FROM club_post_comments WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '댓글이 등록되었습니다.', comment: newComment });
});

// Schedule Comments & Replies (모임 일정 댓글 등록)
clubsRouter.post('/:id/schedules/:scheduleId/comments', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const scheduleId = parseInt(req.params.scheduleId);
  const user = req.user;
  const { content, parent_comment_id } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
  }

  const schedule = db.prepare('SELECT id FROM club_schedules WHERE id = ? AND club_id = ?').get(scheduleId, clubId);
  if (!schedule) {
    return res.status(404).json({ error: '모임 일정을 찾을 수 없습니다.' });
  }

  const result = db.prepare(`
    INSERT INTO club_post_comments (post_id, schedule_id, parent_comment_id, user_id, user_name, user_cell, content)
    VALUES (0, ?, ?, ?, ?, ?, ?)
  `).run(
    scheduleId,
    parent_comment_id ? parseInt(parent_comment_id) : null,
    user?.id,
    user?.name,
    user?.cell_name,
    content.trim()
  );

  const newComment = db.prepare('SELECT * FROM club_post_comments WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '일정에 댓글이 등록되었습니다.', comment: newComment });
});

// Poll Comments & Replies (투표글 댓글 등록)
clubsRouter.post('/:id/polls/:pollId/comments', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const pollId = parseInt(req.params.pollId);
  const user = req.user;
  const { content, parent_comment_id } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: '댓글 내용을 입력해주세요.' });
  }

  const poll = db.prepare('SELECT id FROM club_polls WHERE id = ? AND club_id = ?').get(pollId, clubId);
  if (!poll) {
    return res.status(404).json({ error: '투표를 찾을 수 없습니다.' });
  }

  const result = db.prepare(`
    INSERT INTO club_post_comments (post_id, poll_id, parent_comment_id, user_id, user_name, user_cell, content)
    VALUES (0, ?, ?, ?, ?, ?, ?)
  `).run(
    pollId,
    parent_comment_id ? parseInt(parent_comment_id) : null,
    user?.id,
    user?.name,
    user?.cell_name,
    content.trim()
  );

  const newComment = db.prepare('SELECT * FROM club_post_comments WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '투표에 댓글이 등록되었습니다.', comment: newComment });
});

clubsRouter.delete('/:id/comments/:commentId', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const commentId = parseInt(req.params.commentId);
  const user = req.user;

  const comment = db.prepare('SELECT * FROM club_post_comments WHERE id = ?').get(commentId) as any;
  if (!comment) {
    return res.status(404).json({ error: '댓글을 찾을 수 없습니다.' });
  }

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  const isManager = checkIsClubManager(club, user);
  const isMediaAdmin = user?.role === 'media_admin';
  const isAdmin = user?.role === 'head_admin' || user?.role === 'server_admin';

  // 작성자 본인, 총무, 미디어 관리자, 전체 관리자에게 댓글 삭제 권한 부여
  if (comment.user_id !== user?.id && !isManager && !isMediaAdmin && !isAdmin) {
    return res.status(403).json({ error: '작성자 본인, 총무 또는 미디어 관리자만 삭제할 수 있습니다.' });
  }

  // Delete comment and any replies
  db.prepare('DELETE FROM club_post_comments WHERE id = ? OR parent_comment_id = ?').run(commentId, commentId);
  // Also clean up any reactions on this comment
  db.prepare("DELETE FROM club_reactions WHERE target_type = 'comment' AND target_id = ?").run(commentId);

  res.json({ message: '댓글이 삭제되었습니다.' });
});

// 11. Emoji Reactions Toggle (Amen, Heart, Like, Fire)
clubsRouter.post('/:id/reactions', (req: AuthRequest, res: Response) => {
  const user = req.user;
  const { targetType, targetId, emoji } = req.body;

  const validTypes = ['post', 'comment', 'schedule'];
  const validEmojis = ['amen', 'heart', 'like', 'fire', 'smile'];

  if (!validTypes.includes(targetType) || !validEmojis.includes(emoji)) {
    return res.status(400).json({ error: '올바르지 않은 반응 요청입니다.' });
  }

  // Check if reaction already exists
  const existing = db.prepare(`
    SELECT id FROM club_reactions
    WHERE target_type = ? AND target_id = ? AND user_id = ? AND emoji = ?
  `).get(targetType, targetId, user?.id, emoji) as any;

  let active = false;
  if (existing) {
    db.prepare('DELETE FROM club_reactions WHERE id = ?').run(existing.id);
    active = false;
  } else {
    db.prepare(`
      INSERT INTO club_reactions (target_type, target_id, user_id, emoji)
      VALUES (?, ?, ?, ?)
    `).run(targetType, targetId, user?.id, emoji);
    active = true;
  }

  // Return updated reactions for this target
  const rawReactions = db.prepare(`
    SELECT emoji, COUNT(*) as count FROM club_reactions
    WHERE target_type = ? AND target_id = ?
    GROUP BY emoji
  `).all(targetType, targetId) as any[];

  const reactions: Record<string, number> = { amen: 0, heart: 0, like: 0, fire: 0, smile: 0 };
  rawReactions.forEach((r) => { reactions[r.emoji] = r.count; });

  const myReactions = db.prepare(`
    SELECT emoji FROM club_reactions
    WHERE target_type = ? AND target_id = ? AND user_id = ?
  `).all(targetType, targetId, user?.id).map((r: any) => r.emoji);

  res.json({
    active,
    reactions,
    my_reactions: myReactions,
  });
});

// 12. Manager Handover & Agreement System (3 managers max, 2-agree rule)
clubsRouter.post('/:id/handover/propose', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const user = req.user;
  const { targetUserId, actionType } = req.body; // actionType: 'appoint' | 'dismiss'

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!club) return res.status(404).json({ error: '모영을 찾을 수 없습니다.' });

  const isManager = checkIsClubManager(club, user);
  if (!isManager) {
    return res.status(403).json({ error: '총무 권한을 가진 성도만 안건을 발의할 수 있습니다.' });
  }

  const targetUser = db.prepare('SELECT id, name FROM users WHERE id = ?').get(targetUserId) as any;
  if (!targetUser) {
    return res.status(404).json({ error: '대상 성도를 찾을 수 없습니다.' });
  }

  const currentManagers = (club.manager_names || '').split(',').map((s: string) => s.trim()).filter(Boolean);

  if (actionType === 'appoint') {
    if (currentManagers.includes(targetUser.name)) {
      return res.status(400).json({ error: '이미 해당 모영의 총무로 활동 중인 성도입니다.' });
    }
    if (currentManagers.length >= 3) {
      return res.status(400).json({ error: '총무는 최대 3명까지만 가능합니다. 먼저 기존 총무 해임 안건을 발의해 주세요.' });
    }
  } else if (actionType === 'dismiss') {
    if (!currentManagers.includes(targetUser.name)) {
      return res.status(400).json({ error: '해당 모영의 총무가 아닙니다.' });
    }
    if (currentManagers.length <= 1) {
      return res.status(400).json({ error: '최소 1명의 총무가 유지되어야 합니다.' });
    }
  }

  // Create proposal with proposer auto-agreed
  const result = db.prepare(`
    INSERT INTO club_manager_handover_votes (club_id, proposer_id, proposer_name, target_user_id, target_user_name, action_type, agreed_user_ids, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
  `).run(
    clubId,
    user?.id,
    user?.name,
    targetUser.id,
    targetUser.name,
    actionType,
    JSON.stringify([user?.id])
  );

  const newVote = db.prepare('SELECT * FROM club_manager_handover_votes WHERE id = ?').get(result.lastInsertRowid);
  res.json({
    message: `${actionType === 'appoint' ? '새 총무 선임' : '총무 해임'} 안건이 발의되었습니다. 다른 총무 1명의 동의 시 즉시 반영됩니다.`,
    vote: newVote,
  });
});

clubsRouter.post('/:id/handover/:voteId/agree', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const voteId = parseInt(req.params.voteId);
  const user = req.user;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!club) return res.status(404).json({ error: '모영을 찾을 수 없습니다.' });

  const isManager = checkIsClubManager(club, user);
  if (!isManager) {
    return res.status(403).json({ error: '총무만 동의할 수 있습니다.' });
  }

  const vote = db.prepare('SELECT * FROM club_manager_handover_votes WHERE id = ? AND club_id = ?').get(voteId, clubId) as any;
  if (!vote || vote.status !== 'pending') {
    return res.status(404).json({ error: '진행 중인 안건이 아닙니다.' });
  }

  let agreedIds: number[] = [];
  try {
    agreedIds = JSON.parse(vote.agreed_user_ids || '[]');
  } catch {
    agreedIds = [];
  }

  if (!user || !user.id) {
    return res.status(401).json({ error: '인증 정보가 올바르지 않습니다.' });
  }


  if (agreedIds.includes(user.id)) {
    return res.status(400).json({ error: '이미 동의하신 안건입니다.' });
  }

  agreedIds.push(user.id);


  // Check if 2 or more managers agreed (or if there's only 1 manager, 1 is enough)
  const currentManagers = (club.manager_names || '').split(',').map((s: string) => s.trim()).filter(Boolean);
  const requiredCount = Math.min(2, currentManagers.length);

  if (agreedIds.length >= requiredCount) {
    // Execute handover!
    let newManagers = [...currentManagers];
    if (vote.action_type === 'appoint') {
      if (!newManagers.includes(vote.target_user_name)) {
        newManagers.push(vote.target_user_name);
      }
    } else if (vote.action_type === 'dismiss') {
      newManagers = newManagers.filter((m) => m !== vote.target_user_name);
    }

    const updatedManagerNames = newManagers.join(', ');
    db.prepare('UPDATE clubs SET manager_names = ? WHERE id = ?').run(updatedManagerNames, clubId);

    db.prepare(`
      UPDATE club_manager_handover_votes
      SET agreed_user_ids = ?, status = 'completed'
      WHERE id = ?
    `).run(JSON.stringify(agreedIds), voteId);

    return res.json({
      message: `총무 2인 합의가 완료되어 ${vote.target_user_name} 성도님의 ${vote.action_type === 'appoint' ? '선임' : '해임'}이 즉시 반영되었습니다! 🎉`,
      status: 'completed',
      manager_names: updatedManagerNames,
    });
  } else {
    db.prepare(`
      UPDATE club_manager_handover_votes
      SET agreed_user_ids = ?
      WHERE id = ?
    `).run(JSON.stringify(agreedIds), voteId);

    return res.json({
      message: '안건에 동의하셨습니다. (총무 1명 추가 동의 필요)',
      status: 'pending',
      agreed_count: agreedIds.length,
    });
  }
});

