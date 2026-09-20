import { Router, Response } from 'express';
import { db } from '../db.js';
import { AuthRequest, authenticateToken } from '../middleware/auth.js';

export const clubsRouter = Router();

// All routes require user authentication
clubsRouter.use(authenticateToken);

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

  // Polls
  const rawPolls = db.prepare(`
    SELECT * FROM club_polls
    WHERE club_id = ?
    ORDER BY is_closed ASC, end_date ASC
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

    const isExpired = new Date(p.end_date).getTime() < Date.now();

    return {
      ...p,
      options: parsedOptions,
      total_votes: votes.length,
      option_counts: optionCounts,
      my_vote: userVote ? userVote.selected_option : null,
      is_expired: isExpired,
    };
  });

  // Posts (Community Feed)
  const posts = db.prepare(`
    SELECT * FROM club_posts
    WHERE club_id = ?
    ORDER BY created_at DESC
    LIMIT 50
  `).all(clubId);

  // Schedules (Gatherings)
  const rawSchedules = db.prepare(`
    SELECT * FROM club_schedules
    WHERE club_id = ?
    ORDER BY event_date ASC
  `).all(clubId) as any[];

  const schedules = rawSchedules.map((s) => {
    let attendees: any[] = [];
    try {
      attendees = JSON.parse(s.attendees || '[]');
    } catch {
      attendees = [];
    }
    const isAttending = attendees.some((a) => a.userId === user?.id);
    return {
      ...s,
      attendees,
      is_attending: isAttending,
    };
  });

  // Photos (Gallery)
  const photos = db.prepare(`
    SELECT * FROM club_photos
    WHERE club_id = ?
    ORDER BY created_at DESC
    LIMIT 40
  `).all(clubId);

  res.json({
    club,
    isManager,
    polls,
    posts,
    schedules,
    photos,
  });
});

// 2. Update Club Name and Description (Managers or Head Admin only)
clubsRouter.post('/:id/info', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const user = req.user;
  const { name, description, icon } = req.body;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!club) return res.status(404).json({ error: '모영을 찾을 수 없습니다.' });

  if (!checkIsClubManager(club, user)) {
    return res.status(403).json({ error: '모영 소개 및 정보 수정은 해당 모영 총무 또는 전체 관리자만 가능합니다.' });
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

// 5. Close Poll (Managers or Head Admin)
clubsRouter.post('/:id/polls/:pollId/close', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const pollId = parseInt(req.params.pollId);
  const user = req.user;

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  if (!checkIsClubManager(club, user)) {
    return res.status(403).json({ error: '투표 마감은 총무 또는 전체 관리자만 가능합니다.' });
  }

  db.prepare('UPDATE club_polls SET is_closed = 1 WHERE id = ? AND club_id = ?').run(pollId, clubId);
  res.json({ message: '투표가 조기 마감 처리되었습니다.' });
});

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

// 7. Community Feed Posts
clubsRouter.post('/:id/posts', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const user = req.user;
  const { content, image_url } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: '내용을 입력해주세요.' });
  }

  const result = db.prepare(`
    INSERT INTO club_posts (club_id, user_id, user_name, user_cell, content, image_url)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(clubId, user?.id, user?.name, user?.cell_name || '둔산제일교회', content.trim(), image_url || null);

  const newPost = db.prepare('SELECT * FROM club_posts WHERE id = ?').get(result.lastInsertRowid);
  res.json({ message: '나눔 글이 등록되었습니다.', post: newPost });
});

clubsRouter.delete('/:id/posts/:postId', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const postId = parseInt(req.params.postId);
  const user = req.user;

  const post = db.prepare('SELECT * FROM club_posts WHERE id = ? AND club_id = ?').get(postId, clubId) as any;
  if (!post) return res.status(404).json({ error: '게시글을 찾을 수 없습니다.' });

  const club = db.prepare('SELECT * FROM clubs WHERE id = ?').get(clubId) as any;
  const isManager = checkIsClubManager(club, user);

  if (post.user_id !== user?.id && !isManager) {
    return res.status(403).json({ error: '작성자 본인 또는 총무만 삭제할 수 있습니다.' });
  }

  db.prepare('DELETE FROM club_posts WHERE id = ?').run(postId);
  res.json({ message: '글이 삭제되었습니다.' });
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
  res.json({ message: '일정이 삭제되었습니다.' });
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

// 9. Photos (Gallery)
clubsRouter.post('/:id/photos', (req: AuthRequest, res: Response) => {
  const clubId = parseInt(req.params.id);
  const user = req.user;
  const { image_url, caption } = req.body;

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
