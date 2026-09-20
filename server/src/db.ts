import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';

const currentDir = typeof __dirname !== 'undefined' ? __dirname : path.join(process.cwd(), 'src');
export const serverRoot = path.resolve(currentDir, '..');

export const dataDir = path.join(serverRoot, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'dfmc.db');
export const db = new Database(dbPath);



// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      cell_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member', -- 'server_admin', 'head_admin', 'member'
      cell_verified INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS server_security (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      auth_code TEXT,
      code_expires_at INTEGER,
      fail_count INTEGER DEFAULT 0,
      cooldown_until INTEGER DEFAULT 0,
      is_locked INTEGER DEFAULT 0,
      last_attempt_at INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cells (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS popups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content_text TEXT NOT NULL,
      image_url TEXT,
      end_date TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER,
      author_name TEXT NOT NULL,
      is_pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clubs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT NOT NULL,
      manager_names TEXT DEFAULT '',
      member_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS poll_highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER,
      club_name TEXT NOT NULL,
      poll_title TEXT NOT NULL,
      end_date TEXT NOT NULL,
      voters_count INTEGER DEFAULT 0,
      total_members INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS traffic_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      status_code INTEGER,
      ip TEXT
    );

    CREATE TABLE IF NOT EXISTS lobby_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      welcome_tagline TEXT DEFAULT '은혜와 교제가 넘치는 둔산제일교회 모영',
      welcome_message TEXT DEFAULT '이번 주에도 모영에서 기쁨의 교제 함께해요.',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Phase 2 Tables
    CREATE TABLE IF NOT EXISTS club_polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      options TEXT NOT NULL, -- JSON array of strings: '["참석", "불참"]'
      end_date TEXT NOT NULL,
      is_closed INTEGER DEFAULT 0,
      creator_id INTEGER,
      creator_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS club_poll_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      selected_option TEXT NOT NULL,
      voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(poll_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS club_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_cell TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS club_schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      event_date TEXT NOT NULL,
      location TEXT NOT NULL,
      fee_info TEXT DEFAULT '무료',
      attendees TEXT DEFAULT '[]', -- JSON array of attendee objects
      creator_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS club_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      image_url TEXT NOT NULL,
      caption TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS club_post_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      parent_comment_id INTEGER DEFAULT NULL,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      user_cell TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS club_reactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_type TEXT NOT NULL, -- 'post' or 'comment'
      target_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      emoji TEXT NOT NULL, -- 'amen', 'heart', 'like', 'fire'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(target_type, target_id, user_id, emoji)
    );

    CREATE TABLE IF NOT EXISTS club_manager_handover_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      club_id INTEGER NOT NULL,
      proposer_id INTEGER NOT NULL,
      proposer_name TEXT NOT NULL,
      target_user_id INTEGER NOT NULL,
      target_user_name TEXT NOT NULL,
      action_type TEXT NOT NULL, -- 'dismiss' | 'appoint'
      agreed_user_ids TEXT DEFAULT '[]', -- JSON array of user IDs
      status TEXT DEFAULT 'pending', -- 'pending' | 'completed' | 'rejected'
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Initialize server_security row
  const sec = db.prepare('SELECT * FROM server_security WHERE id = 1').get();
  if (!sec) {
    db.prepare(`
      INSERT INTO server_security (id, auth_code, code_expires_at, fail_count, cooldown_until, is_locked, last_attempt_at)
      VALUES (1, NULL, 0, 0, 0, 0, 0)
    `).run();
  }

  // Initialize lobby_settings row
  const lobbySet = db.prepare('SELECT * FROM lobby_settings WHERE id = 1').get();
  if (!lobbySet) {
    db.prepare(`
      INSERT INTO lobby_settings (id, welcome_tagline, welcome_message)
      VALUES (1, '은혜와 교제가 넘치는 둔산제일교회 모영', '이번 주에도 모영에서 기쁨의 교제 함께해요.')
    `).run();
  }

  // Seed default cells (Only actual cells)
  const defaultCells = ['1청년부 1셀', '1청년부 2셀', '1청년부 3셀', '2청년부 1셀', '2청년부 2셀', '장년 1셀', '장년 2셀', '새가족부'];
  db.prepare("DELETE FROM cells WHERE name = '둔산제일교회'").run(); // Ensure no bypass loophole

  const cellCount = db.prepare('SELECT COUNT(*) as count FROM cells').get() as { count: number };
  if (cellCount.count === 0) {
    const insertCell = db.prepare('INSERT OR IGNORE INTO cells (name) VALUES (?)');
    for (const cell of defaultCells) {
      insertCell.run(cell);
    }
  }

  // Seed default users
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
  if (userCount.count === 0) {
    const insertUser = db.prepare(`
      INSERT INTO users (username, password_hash, name, cell_name, role, cell_verified)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    // 1. Server Admin: dfmc8470 / admin1234
    const adminPassHash = bcrypt.hashSync('admin1234', 10);
    insertUser.run('dfmc8470', adminPassHash, '서버관리자', '둔산제일교회', 'server_admin');

    // 2. Head Admin: pastor / pastor1234
    const pastorPassHash = bcrypt.hashSync('pastor1234', 10);
    insertUser.run('pastor', pastorPassHash, '김목사', '둔산제일교회', 'head_admin');

    // 3. Regular Member: member1 / member1234
    const memberPassHash = bcrypt.hashSync('member1234', 10);
    insertUser.run('member1', memberPassHash, '홍길동', '1청년부 1셀', 'member');

    // 4. Another Member: member2 / member1234
    insertUser.run('member2', memberPassHash, '이은혜', '1청년부 2셀', 'member');
  }

  // Seed 100 Realistic Korean Test Members (user1 ~ user100)
  const koreanNames = [
    '이주환', '강동원', '김민준', '박민수', '이서준', '박도윤', '최영호', '김지은', '정예준', '정다은',
    '최시우', '강하준', '조주원', '윤건우', '임선우', '한서진', '오연우', '신민재', '유현우', '배지호',
    '백지훈', '송우진', '고도현', '문건우', '양승민', '손민성', '권태양', '황준혁', '안지환', '송민규',
    '전태윤', '홍승현', '구진우', '류재원', '곽동하', '심정우', '노시환', '하선호', '곽민혁', '문준서',
    '성시우', '차우진', '우진성', '주선율', '민현우', '진도훈', '변도현', '여승우', '추민재', '도하준',
    '강민서', '김서연', '이서윤', '박지우', '정서현', '최하은', '조하윤', '윤서아', '장지아', '임지유',
    '한채원', '오수아', '서다은', '신예은', '권지원', '황수빈', '안소은', '송예린', '전하린', '홍유나',
    '유서하', '고하은', '문채은', '양지안', '손소율', '배채윤', '조예원', '백시아', '허서율', '유은서',
    '남하율', '심지민', '노다온', '정아린', '하가은', '곽소윤', '성시은', '차예나', '변서영', '우수아',
    '주채원', '민다인', '진서은', '여가은', '도유빈', '구예나', '강서하', '배수현', '신유진', '임예솔'
  ];

  const defaultUserPassHash = bcrypt.hashSync('user1234', 10);
  const insert100 = db.prepare(`
    INSERT OR IGNORE INTO users (username, password_hash, name, cell_name, role, cell_verified)
    VALUES (?, ?, ?, ?, 'member', 1)
  `);

  const memberInsertTransaction = db.transaction(() => {
    koreanNames.forEach((name, idx) => {
      const uname = `user${idx + 1}`;
      const cell = defaultCells[idx % defaultCells.length];
      insert100.run(uname, defaultUserPassHash, name, cell);
    });
  });
  memberInsertTransaction();

  // Seed 4 Major Moyoung Clubs
  const clubCount = db.prepare('SELECT COUNT(*) as count FROM clubs').get() as { count: number };
  if (clubCount.count === 0) {
    const insertClub = db.prepare(`
      INSERT INTO clubs (name, icon, description, manager_names, member_count)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertClub.run('풋살 모영', '⚽', '풋살과 축구를 통해 건강과 은혜로운 교제를 나누는 모임입니다.', '이주환, 강동원, 김민준', 28);
    insertClub.run('배드민턴 모영', '🏸', '매주 토요일 체육관에서 땀 흘리며 친교하는 배드민턴 클럽입니다.', '박민수, 이서준, 박도윤', 35);
    insertClub.run('볼링 모영', '🎳', '남녀노소 누구나 즐겁게 스트라이크를 치며 스트레스를 날려요!', '최영호, 김지은, 정예준', 19);
    insertClub.run('독서 모영', '📚', '한 달에 한 권 신앙 서적과 인문학 도서를 읽고 마음을 나누는 시간.', '정다은, 최시우, 강하준', 24);
  } else {
    // Ensure all 4 major clubs exist
    const hasFutsal = db.prepare("SELECT id FROM clubs WHERE name = '풋살 모영'").get();
    if (!hasFutsal) {
      db.prepare(`
        INSERT INTO clubs (id, name, icon, description, manager_names, member_count)
        VALUES (1, '풋살 모영', '⚽', '풋살과 축구를 통해 건강과 은혜로운 교제를 나누는 모임입니다.', '이주환, 강동원, 김민준', 28)
      `).run();
    }

    // Ensure all 4 clubs have 3 managers each from test users
    db.prepare("UPDATE clubs SET manager_names = '이주환, 강동원, 김민준' WHERE name = '풋살 모영'").run();
    db.prepare("UPDATE clubs SET manager_names = '박민수, 이서준, 박도윤' WHERE name = '배드민턴 모영'").run();
    db.prepare("UPDATE clubs SET manager_names = '최영호, 김지은, 정예준' WHERE name = '볼링 모영'").run();
    db.prepare("UPDATE clubs SET manager_names = '정다은, 최시우, 강하준' WHERE name = '독서 모영'").run();


    // Migration: Update existing clubs to Moyoung branding
    db.prepare("UPDATE clubs SET name = replace(name, '동호회', '모영') WHERE name LIKE '%동호회%'").run();
    db.prepare("UPDATE clubs SET description = replace(description, '동호회', '모영') WHERE description LIKE '%동호회%'").run();
    db.prepare("UPDATE poll_highlights SET club_name = replace(club_name, '동호회', '모영') WHERE club_name LIKE '%동호회%'").run();
    db.prepare("UPDATE notices SET title = replace(title, '동호회', '모영'), content = replace(content, '동호회', '모영') WHERE title LIKE '%동호회%' OR content LIKE '%동호회%'").run();
    db.prepare("UPDATE popups SET title = replace(title, '동호회', '모영'), content_text = replace(content_text, '동호회', '모영') WHERE title LIKE '%동호회%' OR content_text LIKE '%동호회%'").run();
  }

  // Seed initial Notice
  const noticeCount = db.prepare('SELECT COUNT(*) as count FROM notices').get() as { count: number };
  if (noticeCount.count === 0) {
    db.prepare(`
      INSERT INTO notices (title, content, author_name, is_pinned)
      VALUES (?, ?, ?, 1)
    `).run(
      '2026년 상반기 둔산제일교회 모영 활동 안내 및 친교 주간',
      '할렐루야! 성도 간의 아름다운 코이노니아를 위해 4대 모영(풋살 모영, 배드민턴 모영, 볼링 모영, 독서 모영)이 새 시즌을 맞이합니다. 모든 성도님들의 많은 관심과 적극적인 참여를 축복합니다. (문의: 김목사 / 각 모영 총무)',
      '김목사'
    );
  } else {
    db.prepare("UPDATE notices SET title = '2026년 상반기 둔산제일교회 모영 활동 안내 및 친교 주간' WHERE title LIKE '%동호회 활성화%'").run();
  }

  // Seed multiple active poll highlights with varying deadlines
  const pollCount = db.prepare('SELECT COUNT(*) as count FROM poll_highlights').get() as { count: number };
  if (pollCount.count < 3) {
    db.prepare("DELETE FROM poll_highlights").run();
    const insertPoll = db.prepare(`
      INSERT INTO poll_highlights (club_id, club_name, poll_title, end_date, voters_count, total_members)
      VALUES (?, ?, ?, ?, ?, 0)
    `);

    // 1. Most urgent (2 days later)
    insertPoll.run(1, '풋살 모영', '이번 주 토요일 풋살장 참석 투표 (조끼/풋살공 준비)', '2026-09-22T18:00:00', 19);
    // 2. Intermediate (5 days later)
    insertPoll.run(2, '배드민턴 모영', '정기 친선 배드민턴 리그전 참가 신청 및 라켓 대여 조사', '2026-09-25T23:59:59', 27);
    // 3. Further (9 days later)
    insertPoll.run(3, '볼링 모영', '가을 볼링 챔피언십 2인 1조 팀 매칭 희망 조사', '2026-09-29T23:59:59', 14);
  } else {
    db.prepare("UPDATE poll_highlights SET club_name = '풋살 모영' WHERE club_name = '풋살 동호회'").run();
  }

  // Seed default Popup
  const popupCount = db.prepare('SELECT COUNT(*) as count FROM popups').get() as { count: number };
  if (popupCount.count === 0) {
    db.prepare(`
      INSERT INTO popups (title, content_text, image_url, end_date, is_active)
      VALUES (?, ?, ?, ?, 1)
    `).run(
      '2026 전교인 한마음 체육대회 & 모영 축제',
      '청년부와 장년부가 함께하는 가을 체육대회가 곧 개최됩니다! 각 모영 부스 체험 및 푸짐한 경품이 준비되어 있으니 성도 여러분의 많은 참여 바랍니다.',
      'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80',
      '2026-10-31T23:59:59'
    );
  } else {
    db.prepare("UPDATE popups SET title = '2026 전교인 한마음 체육대회 & 모영 축제' WHERE title LIKE '%동호회 축제%'").run();
  }

  // --- Phase 2: Seed Club Polls ---
  const cpCount = db.prepare('SELECT COUNT(*) as count FROM club_polls').get() as { count: number };
  if (cpCount.count === 0) {
    const insertCP = db.prepare(`
      INSERT INTO club_polls (club_id, title, description, options, end_date, is_closed, creator_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Futsal poll
    insertCP.run(
      1,
      '이번 주 토요일 풋살장 참석 투표 (조끼/풋살공 준비)',
      '토요일 오후 2시 대전 풋살파크 구장비 정산 및 인원 파악을 위한 투표입니다. 늦지 않게 와주세요!',
      JSON.stringify(['참석 (경기 참여)', '불참', '응원 및 관람']),
      '2026-09-22T18:00:00',
      0,
      '이주환'
    );

    // Badminton poll
    insertCP.run(
      2,
      '정기 친선 배드민턴 리그전 참가 신청 및 라켓 대여 조사',
      '개인 라켓 유무 및 복식 파트너 매칭을 진행합니다.',
      JSON.stringify(['개인 라켓 지참', '라켓 대여 희망', '불참']),
      '2026-09-25T23:59:59',
      0,
      '박민수'
    );

    // Bowling poll
    insertCP.run(
      3,
      '가을 볼링 챔피언십 2인 1조 팀 매칭 희망 조사',
      '공정한 팀 편성을 위한 설문입니다.',
      JSON.stringify(['랜덤 제비뽑기 매칭', '실력별 핸디캡 매칭', '자유 팀 구성']),
      '2026-09-29T23:59:59',
      0,
      '최영호'
    );

    // Reading poll
    insertCP.run(
      4,
      '10월의 함께 읽을 신앙 도서 선정 투표',
      '한 달간 함께 읽고 은혜를 나눌 책을 골라주세요.',
      JSON.stringify(['팀 켈러 - 인생 질문', 'CS 루이스 - 순전한 기독교', '헨리 나우웬 - 상처받은 치유자']),
      '2026-10-05T20:00:00',
      0,
      '정다은'
    );

    // Seed initial votes for Futsal poll (poll_id = 1)
    const insertVote = db.prepare(`
      INSERT OR IGNORE INTO club_poll_votes (poll_id, user_id, user_name, selected_option)
      VALUES (?, ?, ?, ?)
    `);
    insertVote.run(1, 4, '이주환', '참석 (경기 참여)');
    insertVote.run(1, 5, '강동원', '참석 (경기 참여)');
    insertVote.run(1, 6, '김민준', '참석 (경기 참여)');
    insertVote.run(1, 7, '박민수', '응원 및 관람');
    insertVote.run(1, 8, '이서준', '불참');
  }

  // --- Phase 2: Seed Club Posts (Feed) ---
  const postCount = db.prepare('SELECT COUNT(*) as count FROM club_posts').get() as { count: number };
  if (postCount.count === 0) {
    const insertPost = db.prepare(`
      INSERT INTO club_posts (club_id, user_id, user_name, user_cell, content, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertPost.run(
      1,
      4,
      '이주환',
      '1청년부 1셀',
      '할렐루야! 이번 주말 풋살 모영 모임도 부상 없이 안전하고 기쁜 교제의 시간 되기를 소망합니다. 음료수는 총무단에서 시원하게 준비해 가겠습니다! ⚽🙌',
      null
    );
    insertPost.run(
      1,
      5,
      '강동원',
      '1청년부 1셀',
      '새로 오신 성도님들도 부담 갖지 마시고 편한 운동복 차림으로 오시면 됩니다. 조끼와 공 모두 구비되어 있습니다! 환영합니다~',
      null
    );

    insertPost.run(
      2,
      7,
      '박민수',
      '2청년부 1셀',
      '배드민턴 모영 성도님들 반갑습니다! 토요일 아침 상쾌하게 땀 흘리며 스트레스 날려보아요 🏸',
      null
    );

    insertPost.run(
      4,
      13,
      '정다은',
      '장년 1셀',
      '10월 추천 도서 후보 목록 확인하시고 투표 탭에서 투표 꼭 참여해 주세요 📖 마음에 큰 울림이 있는 책으로 정해지길 기대합니다.',
      null
    );
  }

  // --- Phase 2: Seed Club Schedules ---
  const schedCount = db.prepare('SELECT COUNT(*) as count FROM club_schedules').get() as { count: number };
  if (schedCount.count === 0) {
    const insertSched = db.prepare(`
      INSERT INTO club_schedules (club_id, title, event_date, location, fee_info, attendees, creator_name)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertSched.run(
      1,
      '9월 4주차 토요 정기 풋살 경기',
      '2026-09-26 14:00 ~ 16:00',
      '대전 풋살파크 B구장 (둔산동)',
      '구장비 10,000원 (생수/이온음료 제공)',
      JSON.stringify([
        { userId: 4, userName: '이주환', cellName: '1청년부 1셀' },
        { userId: 5, userName: '강동원', cellName: '1청년부 1셀' },
        { userId: 6, userName: '김민준', cellName: '1청년부 1셀' },
      ]),
      '이주환'
    );

    insertSched.run(
      2,
      '토요 오전 모닝 배드민턴 클럽 정기 모임',
      '2026-09-26 09:30 ~ 11:30',
      '제일체육관 2층 3코트',
      '셔틀콕 및 대관료 5,000원',
      JSON.stringify([
        { userId: 7, userName: '박민수', cellName: '2청년부 1셀' },
        { userId: 8, userName: '이서준', cellName: '2청년부 1셀' },
      ]),
      '박민수'
    );

    insertSched.run(
      4,
      '10월 1주차 독서 나눔 및 티타임 모임',
      '2026-10-03 15:00 ~ 17:00',
      '교회 1층 카페 로뎀',
      '음료 각자 주문 (책 지참)',
      JSON.stringify([
        { userId: 13, userName: '정다은', cellName: '장년 1셀' },
      ]),
      '정다은'
    );
  }

  // --- Phase 2: Seed Club Photos ---
  const photoCount = db.prepare('SELECT COUNT(*) as count FROM club_photos').get() as { count: number };
  if (photoCount.count === 0) {
    const insertPhoto = db.prepare(`
      INSERT INTO club_photos (club_id, user_id, user_name, image_url, caption)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertPhoto.run(
      1,
      4,
      '이주환',
      'https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80',
      '지난 주말 풋살 경기 후 단체 기념 사진! 모두 수고 많으셨습니다 🙏'
    );
    insertPhoto.run(
      1,
      5,
      '강동원',
      'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=800&q=80',
      '열정 넘쳤던 후반전 경기 모습 ⚽'
    );
    insertPhoto.run(
      2,
      7,
      '박민수',
      'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=80',
      '즐거웠던 토요 배드민턴 랠리 현장!'
    );
    insertPhoto.run(
      4,
      13,
      '정다은',
      'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?auto=format&fit=crop&w=800&q=80',
      '따뜻한 커피와 함께한 은혜로운 책 나눔의 시간 ☕'
    );
  }

  // --- Seed Comments & Replies ---
  const commentCount = db.prepare('SELECT COUNT(*) as count FROM club_post_comments').get() as { count: number };
  if (commentCount.count === 0) {
    const insertComment = db.prepare(`
      INSERT INTO club_post_comments (post_id, parent_comment_id, user_id, user_name, user_cell, content)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Comment on Futsal Post 1
    const post1 = db.prepare('SELECT id FROM club_posts WHERE club_id = 1 ORDER BY id ASC LIMIT 1').get() as any;
    if (post1) {
      const c1 = insertComment.run(post1.id, null, 5, '강동원', '1청년부 1셀', '이번 주 토요일 비 안 오면 좋겠네요! 음료수는 제가 준비해 가겠습니다 🥤');
      insertComment.run(post1.id, c1.lastInsertRowid, 4, '이주환', '1청년부 1셀', '동원 형제님 감사합니다! 토요일에 봬요 👍');
      insertComment.run(post1.id, null, 6, '김민준', '1청년부 2셀', '풋살화 새로 샀는데 얼른 뛰고 싶습니다 ㅎㅎ');
    }
  }

  // --- Seed Reactions ---
  const reactionCount = db.prepare('SELECT COUNT(*) as count FROM club_reactions').get() as { count: number };
  if (reactionCount.count === 0) {
    const insertReaction = db.prepare(`
      INSERT OR IGNORE INTO club_reactions (target_type, target_id, user_id, emoji)
      VALUES (?, ?, ?, ?)
    `);

    const posts = db.prepare('SELECT id FROM club_posts LIMIT 4').all() as any[];
    if (posts.length > 0) {
      insertReaction.run('post', posts[0].id, 4, 'fire');
      insertReaction.run('post', posts[0].id, 5, 'heart');
      insertReaction.run('post', posts[0].id, 6, 'amen');
      insertReaction.run('post', posts[0].id, 7, 'like');
    }
  }
}

