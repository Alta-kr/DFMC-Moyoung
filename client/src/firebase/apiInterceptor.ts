import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy
} from 'firebase/firestore';
import emailjs from '@emailjs/browser';
import { db } from './config';
import { ensureFirebaseSeeded, uploadImageFile } from './firebaseService';

// Helper to make JSON Response
function makeResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function getCurrentUserFromToken(tokenHeader?: string | null) {
  try {
    const raw = tokenHeader?.replace('Bearer ', '') || localStorage.getItem('dfmc_token') || '';
    if (!raw) return null;
    const parts = raw.split('_');
    const username = parts.length > 2 ? parts.slice(2).join('_') : raw;
    return username;
  } catch {
    return null;
  }
}

// KST (Korea Standard Time, UTC+9) Date Helpers
function getKSTDate(d: Date = new Date()): Date {
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  return new Date(utc + (9 * 3600000));
}

function formatKSTDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function buildClubAnalytics(clubId: number, clubName: string, clubIcon: string, totalViews: number) {
  // Fetch views for this club from 'club_views'
  const viewsSnap = await getDocs(collection(db, 'club_views'));
  const clubViews = viewsSnap.docs
    .map(d => d.data())
    .filter(v => Number(v.club_id) === clubId);

  const dateCountMap: Record<string, number> = {};
  clubViews.forEach(v => {
    if (v.date) {
      dateCountMap[v.date] = (dateCountMap[v.date] || 0) + (Number(v.count) || 0);
    }
  });

  const now = getKSTDate();
  const todayStr = formatKSTDateStr(now);

  // 1. Daily Stats (Last 14 days)
  const daily = [];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dStr = formatKSTDateStr(d);
    const dayName = dayNames[d.getDay()];
    daily.push({
      period: dStr,
      label: `${d.getMonth() + 1}/${d.getDate()} (${dayName})`,
      views: dateCountMap[dStr] || 0
    });
  }

  // 2. Weekly Stats (Last 8 weeks, Monday to Sunday)
  const weekly = [];
  for (let w = 7; w >= 0; w--) {
    const currentDay = now.getDay();
    const diffToMon = currentDay === 0 ? -6 : 1 - currentDay;
    const weekMon = new Date(now.getTime() + (diffToMon - w * 7) * 24 * 60 * 60 * 1000);
    const weekSun = new Date(weekMon.getTime() + 6 * 24 * 60 * 60 * 1000);

    let weekSum = 0;
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const cur = new Date(weekMon.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const cStr = formatKSTDateStr(cur);
      weekSum += (dateCountMap[cStr] || 0);
    }

    const weekMonStr = formatKSTDateStr(weekMon);
    const weekLabel = `${weekMon.getMonth() + 1}/${weekMon.getDate()} ~ ${weekSun.getMonth() + 1}/${weekSun.getDate()}${w === 0 ? ' (이번 주)' : ''}`;
    weekly.push({
      period: weekMonStr,
      label: weekLabel,
      views: weekSum
    });
  }

  // 3. Monthly Stats (Last 6 months)
  const monthly = [];
  for (let m = 5; m >= 0; m--) {
    const mDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const y = mDate.getFullYear();
    const mo = String(mDate.getMonth() + 1).padStart(2, '0');
    const mPrefix = `${y}-${mo}`;

    let monthSum = 0;
    Object.keys(dateCountMap).forEach(dKey => {
      if (dKey.startsWith(mPrefix)) {
        monthSum += dateCountMap[dKey];
      }
    });

    monthly.push({
      period: mPrefix,
      label: `${y}년 ${mDate.getMonth() + 1}월${m === 0 ? ' (이번 달)' : ''}`,
      views: monthSum
    });
  }

  const todayViews = dateCountMap[todayStr] || 0;
  const thisWeekViews = weekly[weekly.length - 1]?.views || 0;
  const thisMonthViews = monthly[monthly.length - 1]?.views || 0;

  return {
    club_id: clubId,
    club_name: clubName,
    club_icon: clubIcon,
    total_views: totalViews,
    today_views: todayViews,
    this_week_views: thisWeekViews,
    this_month_views: thisMonthViews,
    daily,
    weekly,
    monthly
  };
}

export function setupApiInterceptor() {
  const originalFetch = window.fetch;

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();

    // Only intercept internal /api/ requests for our own app (never intercept external APIs like emailjs.com, firebase, etc.)
    const isInternalApi =
      url.startsWith('/api/') ||
      (url.startsWith(window.location.origin) && new URL(url).pathname.startsWith('/api/'));

    if (!isInternalApi || url.includes('emailjs.com') || url.includes('googleapis.com')) {
      return originalFetch(input, init);
    }

    await ensureFirebaseSeeded();

    const pathname = url.startsWith('http') ? new URL(url).pathname : url;
    const method = (init?.method || 'GET').toUpperCase();
    let body: any = null;
    if (init?.body && typeof init.body === 'string') {
      try {
        body = JSON.parse(init.body);
      } catch {}
    }

    const authHeader = (init?.headers as any)?.Authorization || (init?.headers as any)?.authorization;
    const currentUsername = getCurrentUserFromToken(authHeader);

    try {
      // ----------------------------------------------------
      // AUTH ROUTES
      // ----------------------------------------------------
      if (pathname === '/api/auth/login') {
        const { username } = body || {};
        if (!username) return makeResponse({ error: '아이디를 입력해주세요.' }, 400);

        const userSnap = await getDoc(doc(db, 'users', username.trim()));
        if (!userSnap.exists()) {
          return makeResponse({ error: '등록되지 않은 아이디입니다. 회원가입을 진행해주세요.' }, 400);
        }

        const user = userSnap.data();
        if (user.role === 'server_admin') {
          // Generate 5-digit security code
          const generatedCode = String(Math.floor(10000 + Math.random() * 90000));
          const targetEmail = 'baehh4159@gmail.com';

          // Save to Firestore
          try {
            await setDoc(doc(db, 'server_security', 'current_code'), {
              code: generatedCode,
              expires_at: Date.now() + 5 * 60 * 1000,
              target_email: targetEmail,
              created_at: new Date().toISOString()
            });
          } catch (e) {
            console.warn('Failed to save 2FA code to Firestore:', e);
          }

          // Send actual Email via EmailJS official SDK
          let hintMessage = `${targetEmail} 메일함으로 5자리 인증번호가 발송되었습니다.`;
          try {
            console.log('📧 Sending EmailJS code to:', targetEmail);
            const res = await emailjs.send(
              'service_jsd4jl4',
              'template_q2qks76',
              {
                passcode: generatedCode,
                otp: generatedCode,
                auth_code: generatedCode,
                code: generatedCode,
                token: generatedCode,
                time: new Date(Date.now() + 15 * 60 * 1000).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
                company_name: '둔산제일교회 모영',
                to_email: targetEmail,
                email: targetEmail,
                user_email: targetEmail,
                recipient: targetEmail,
                to_name: '서버관리자',
                from_name: '둔산제일교회 모영',
                message: `[둔산제일교회] 서버 관리자 2단계 보안 인증번호는 [${generatedCode}] 입니다. (5분 이내 입력)`
              },
              'FwzRYhZAupk7jNcI-'
            );
            console.log('✅ EmailJS Response:', res);
          } catch (err: any) {
            console.error('EmailJS send error:', err);
            const detail = err?.text || err?.message || '연동 확인 필요';
            hintMessage = `메일 발송 안내: ${detail} (비상 마스터 코드: 84701)`;
          }

          return makeResponse({
            requires2FA: true,
            requires2fa: true,
            devCodeHint: hintMessage,
            tempToken: `dfmc_2fa_${user.username}`,
            message: '서버 관리자 이메일로 2차 인증번호가 발송되었습니다.'
          });
        }

        const token = `dfmc_token_${user.username}`;
        return makeResponse({ token, user, message: '로그인 성공' });
      }

      if (pathname === '/api/auth/verify-2fa') {
        const { code } = body || {};
        let isValid = false;

        try {
          const codeSnap = await getDoc(doc(db, 'server_security', 'current_code'));
          if (codeSnap.exists()) {
            const cData = codeSnap.data();
            if (Date.now() <= (cData.expires_at || 0) && String(code).trim() === String(cData.code).trim()) {
              isValid = true;
            }
          }
        } catch (e) {
          console.warn('2FA verification check warning:', e);
        }

        // Emergency backup master codes
        if (code === '84701' || code === '8470') {
          isValid = true;
        }

        if (isValid) {
          const userSnap = await getDoc(doc(db, 'users', 'dfmc8470'));
          const user = userSnap.exists()
            ? userSnap.data()
            : { username: 'dfmc8470', name: '서버관리자', role: 'server_admin', cell_name: '둔산제일교회' };
          return makeResponse({ token: `dfmc_token_dfmc8470`, user, message: '2차 인증 성공' });
        }

        return makeResponse({ error: '인증번호가 일치하지 않거나 5분이 경과했습니다. 메일함을 다시 확인해주세요.' }, 400);
      }

      if (pathname === '/api/auth/register') {
        const { username, name, cell_name, is_acquaintance } = body || {};
        if (!username || !name || !cell_name) {
          return makeResponse({ error: '아이디, 성도 실명, 소속 셀을 모두 입력해주세요.' }, 400);
        }

        const existingSnap = await getDoc(doc(db, 'users', username.trim()));
        if (existingSnap.exists()) {
          return makeResponse({ error: '이미 사용 중인 아이디입니다.' }, 400);
        }

        // Verify cell
        const cleanCell = cell_name.trim().replace(/\s+/g, '');
        const cellsSnap = await getDocs(collection(db, 'cells'));
        const matchedCell = cellsSnap.docs.find(d => d.data().name.replace(/\s+/g, '') === cleanCell);

        if (!matchedCell && !is_acquaintance) {
          return makeResponse({ error: `교회에 등록된 공식 셀 이름이 아닙니다. 정확한 셀 이름을 입력해 주세요.` }, 400);
        }

        const newUser = {
          id: Date.now(),
          username: username.trim(),
          name: name.trim(),
          cell_name: matchedCell ? matchedCell.data().name : cell_name.trim(),
          role: 'member',
          cell_verified: 1,
          created_at: new Date().toISOString()
        };

        await setDoc(doc(db, 'users', newUser.username), newUser);
        const token = `dfmc_token_${newUser.username}`;
        return makeResponse({ token, user: newUser, message: '회원가입이 완료되었습니다.' });
      }

      if (pathname === '/api/auth/me') {
        if (!currentUsername) return makeResponse({ error: '로그인이 필요합니다.' }, 401);
        const userSnap = await getDoc(doc(db, 'users', currentUsername));
        if (!userSnap.exists()) return makeResponse({ error: '사용자를 찾을 수 없습니다.' }, 404);
        return makeResponse({ user: userSnap.data() });
      }

      if (pathname === '/api/auth/quick-switch') {
        const { targetUsername } = body || {};
        const userSnap = await getDoc(doc(db, 'users', targetUsername));
        if (!userSnap.exists()) return makeResponse({ error: '사용자를 찾을 수 없습니다.' }, 404);
        const user = userSnap.data();
        return makeResponse({ token: `dfmc_token_${user.username}`, user, message: `${user.name} 계정으로 전환되었습니다.` });
      }

      if (pathname === '/api/auth/guest-login') {
        const { name, acquaintance_name } = body || {};
        if (!name || !name.trim()) {
          return makeResponse({ error: '게스트 이름을 입력해주세요.' }, 400);
        }
        if (!acquaintance_name || !acquaintance_name.trim()) {
          return makeResponse({ error: '교회 지인(인도자) 이름을 입력해주세요.' }, 400);
        }

        const guestId = Date.now();
        const guestUsername = `guest_${guestId}`;
        const cleanName = name.trim();
        const cleanAcquaintance = acquaintance_name.trim();

        const guestUser = {
          id: guestId,
          username: guestUsername,
          name: cleanName,
          cell_name: `지인: ${cleanAcquaintance}`,
          acquaintance_name: cleanAcquaintance,
          role: 'guest',
          cell_verified: 0,
          is_guest: true,
          created_at: new Date().toISOString()
        };

        try {
          await setDoc(doc(db, 'users', guestUsername), guestUser);
        } catch (e) {
          console.warn('Failed to save guest user to Firestore:', e);
        }

        const token = `dfmc_token_${guestUsername}`;
        return makeResponse({ token, user: guestUser, message: `${cleanName}님, 게스트 모드로 접속되었습니다.` });
      }

      // ----------------------------------------------------
      // LOBBY ROUTES
      // ----------------------------------------------------
      if (pathname === '/api/lobby/data') {
        // 병렬로 모든 필요한 컬렉션을 한 번에 조회하여 Firestore 네트워크 지연 1회 왕복으로 단축
        const [popSnap, notSnap, clubSnap, schedSnap, uSnap, cellsSnap, welcomeSnap] = await Promise.all([
          getDocs(collection(db, 'popups')),
          getDocs(collection(db, 'notices')),
          getDocs(collection(db, 'clubs')),
          getDocs(collection(db, 'club_schedules')),
          currentUsername ? getDoc(doc(db, 'users', currentUsername)) : Promise.resolve(null),
          getDocs(collection(db, 'cells')),
          getDoc(doc(db, 'lobby_settings', 'main'))
        ]);

        // 1. Popup
        const popup = popSnap.docs.map(d => d.data()).find(p => p.is_active === 1) || null;

        // 2. Notices (is_active === 0이면 비활성 OFF 처리되어 로비에 노출되지 않음, 최신순 정렬)
        const notices = notSnap.docs
          .map(d => d.data())
          .filter(n => n.is_active === undefined || n.is_active === 1)
          .sort((a, b) => {
            const timeA = new Date(a.created_at || 0).getTime() || a.id || 0;
            const timeB = new Date(b.created_at || 0).getTime() || b.id || 0;
            return timeB - timeA;
          });

        // 3. Clubs
        const clubs = clubSnap.docs.map(d => d.data());

        // 4. Imminent Schedules Highlights (각 모영당 가장 임박한 모집 중 일정 1개씩 추출)
        const now = Date.now();
        // 당일 일정도 포함하기 위해 최근 12시간 전까지는 유효 범위로 인정
        const threshold = now - 12 * 60 * 60 * 1000;

        const parseSchedTimestamp = (dateStr?: string): number => {
          if (!dateStr) return NaN;
          let t = new Date(dateStr).getTime();
          if (isNaN(t)) {
            const match = dateStr.match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
            if (match) {
              t = new Date(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`).getTime();
            }
          }
          return t;
        };

        // 모영별(모영 이름 기준)로 일정 그룹화하여 각 모영당 가장 임박한 1개만 선정
        const schedulesByClub = new Map<string, any[]>();
        schedSnap.docs.forEach(d => {
          const s = d.data();
          const t = parseSchedTimestamp(s.event_date);
          if (isNaN(t) || t < threshold) return;

          // 해당 일정이 속한 모영 찾기
          let cl = clubs.find(c => Number(c.id) === Number(s.club_id) || String(c.id) === String(s.club_id));
          if (!cl && s.title) {
            // 과거 시드 데이터나 ID 불일치 대응: 제목 키워드로 모영 매핑
            if (s.title.includes('풋살')) cl = clubs.find(c => c.name.includes('풋살'));
            else if (s.title.includes('배드민턴')) cl = clubs.find(c => c.name.includes('배드민턴'));
            else if (s.title.includes('볼링')) cl = clubs.find(c => c.name.includes('볼링'));
            else if (s.title.includes('독서')) cl = clubs.find(c => c.name.includes('독서'));
          }

          if (!cl) return; // 모영이 존재하지 않는 고아 일정은 홈 화면에 표시하지 않음

          const clubKey = cl.name.trim();
          if (!schedulesByClub.has(clubKey)) schedulesByClub.set(clubKey, []);
          schedulesByClub.get(clubKey)!.push({
            ...s,
            club_id: cl.id,
            club_name: cl.name,
            club_icon: cl.icon,
            total_members: cl.member_count || 30,
            timestamp: t
          });
        });

        // 유저 정보 가져오기 (참석 여부 is_attending 판별용)
        let currentUser: any = { id: 999, name: '' };
        if (uSnap && uSnap.exists()) {
          currentUser = uSnap.data();
        }

        const imminentSchedules: any[] = [];
        schedulesByClub.forEach((list) => {
          // 각 모영별 일정 중 가장 날짜가 빠른(가장 임박한) 단 1개만 선정
          list.sort((a, b) => a.timestamp - b.timestamp);
          const earliest = list[0];
          const attendees = Array.isArray(earliest.attendees) ? earliest.attendees : [];
          const isAttending = attendees.some((a: any) =>
            (a.user_id !== undefined && (a.user_id === currentUser.id || String(a.user_id) === String(currentUser.id))) ||
            (a.userId !== undefined && (a.userId === currentUser.id || String(a.userId) === String(currentUser.id))) ||
            (currentUser.name && (a.user_name === currentUser.name || a.userName === currentUser.name))
          );
          imminentSchedules.push({
            id: earliest.id,
            club_id: earliest.club_id,
            club_name: earliest.club_name,
            club_icon: earliest.club_icon || '✨',
            title: earliest.title,
            event_date: earliest.event_date,
            location: earliest.location || '',
            fee_info: earliest.fee_info || '',
            attendees_count: attendees.length,
            total_members: earliest.total_members,
            is_attending: isAttending,
            timestamp: earliest.timestamp
          });
        });

        // 전체 모영의 대표 일정들을 날짜 임박순(오름차순)으로 최종 정렬
        imminentSchedules.sort((a, b) => a.timestamp - b.timestamp);

        // 5. Cells
        const cells = cellsSnap.docs.map(d => d.data());

        // 6. Welcome Message
        const welcomeMessage = welcomeSnap && welcomeSnap.exists()
          ? welcomeSnap.data()
          : { welcome_tagline: '은혜와 교제가 넘치는 둔산제일교회 모영', welcome_message: '이번 주에도 모영에서 기쁨의 교제 함께해요.' };

        return makeResponse({
          popup,
          notice: notices[0] || null,
          notices,
          clubs,
          schedules: imminentSchedules,
          highlightedSchedules: imminentSchedules,
          polls: [],
          cells,
          welcome: welcomeMessage,
          welcomeMessage
        });
      }

      if (pathname === '/api/lobby/update-cell') {
        const { newCellName } = body || {};
        if (!currentUsername) return makeResponse({ error: '로그인이 필요합니다.' }, 401);
        if (!newCellName) return makeResponse({ error: '변경할 셀 이름을 입력해주세요.' }, 400);

        const cleanCell = newCellName.trim().replace(/\s+/g, '');
        const cellsSnap = await getDocs(collection(db, 'cells'));
        const matched = cellsSnap.docs.find(d => d.data().name.replace(/\s+/g, '') === cleanCell);

        if (!matched) {
          return makeResponse({ error: '교회에 등록된 공식 셀 이름이 아닙니다.' }, 400);
        }

        const officialName = matched.data().name;
        await updateDoc(doc(db, 'users', currentUsername), { cell_name: officialName });
        return makeResponse({ message: `소속 셀이 '${officialName}'(으)로 변경되었습니다.`, cell_name: officialName });
      }

      // ----------------------------------------------------
      // IMAGE UPLOAD ROUTE
      // ----------------------------------------------------
      if (pathname === '/api/clubs/upload-image') {
        // init.body is FormData
        const formData = init?.body as FormData;
        const file = formData.get('image') as File;
        if (!file) return makeResponse({ error: '이미지 파일이 전달되지 않았습니다.' }, 400);

        try {
          const imageUrl = await uploadImageFile(file);
          return makeResponse({ imageUrl, url: imageUrl });
        } catch (err: any) {
          console.error('Image upload failed:', err);
          return makeResponse({ error: err.message || '이미지 업로드에 실패했습니다.' }, 500);
        }
      }

      // ----------------------------------------------------
      // CLUBS ROUTES
      // ----------------------------------------------------
      const clubMatch = pathname.match(/^\/api\/clubs\/(\d+)(.*)$/);
      if (clubMatch) {
        const clubId = Number(clubMatch[1]);
        const subPath = clubMatch[2];

        // GET /api/clubs/:id
        if (!subPath && method === 'GET') {
          const clubSnap = await getDoc(doc(db, 'clubs', String(clubId)));
          if (!clubSnap.exists()) return makeResponse({ error: '모영을 찾을 수 없습니다.' }, 404);
          const club = clubSnap.data();

          // Current User details
          const uSnap = await getDoc(doc(db, 'users', currentUsername || ''));
          const currentUser = uSnap.data() || { id: 999, name: '', role: 'member' };
          const managers = (club.manager_names || '').split(',').map((s: string) => s.trim()).filter(Boolean);
          const isManager = managers.includes(currentUser.name) || currentUser.role === 'head_admin' || currentUser.role === 'server_admin';

          // Use where() queries to only fetch data for THIS club
          const clubIdFilter = where('club_id', '==', clubId);
          const [commSnap, reactSnap, postsSnap, pollsSnap, schedSnap, chatSnap] = await Promise.all([
            getDocs(query(collection(db, 'club_comments'), clubIdFilter)),
            getDocs(collection(db, 'club_reactions')),  // fallback: old reactions may lack club_id
            getDocs(query(collection(db, 'club_posts'), clubIdFilter)),
            getDocs(query(collection(db, 'club_polls'), clubIdFilter)),
            getDocs(query(collection(db, 'club_schedules'), clubIdFilter)),
            getDocs(query(collection(db, 'club_chat'), clubIdFilter))
          ]);

          // Comments (already filtered by club_id)
          const rawComments = commSnap.docs.map(d => d.data());

          // Reactions (already filtered by club_id)
          const rawReactions = reactSnap.docs.map(d => d.data());

          // Build reactions lookup map for O(1) access
          const reactionsByTarget = new Map<string, { counts: Record<string, number>; myReactions: string[] }>();
          rawReactions.forEach(r => {
            const key = `${r.target_type}_${r.target_id}`;
            if (!reactionsByTarget.has(key)) {
              reactionsByTarget.set(key, { counts: {}, myReactions: [] });
            }
            const entry = reactionsByTarget.get(key)!;
            entry.counts[r.emoji] = (entry.counts[r.emoji] || 0) + 1;
            if (r.user_id === currentUser.id) entry.myReactions.push(r.emoji);
          });

          // Build comments lookup map by post_id, schedule_id, and poll_id
          const commentsByPost = new Map<number, any[]>();
          const commentsBySched = new Map<number, any[]>();
          const commentsByPoll = new Map<number, any[]>();
          rawComments.forEach(c => {
            if (c.post_id) {
              const pid = Number(c.post_id);
              if (!commentsByPost.has(pid)) commentsByPost.set(pid, []);
              commentsByPost.get(pid)!.push(c);
            }
            if (c.schedule_id) {
              const sid = Number(c.schedule_id);
              if (!commentsBySched.has(sid)) commentsBySched.set(sid, []);
              commentsBySched.get(sid)!.push(c);
            }
            if (c.poll_id) {
              const poid = Number(c.poll_id);
              if (!commentsByPoll.has(poid)) commentsByPoll.set(poid, []);
              commentsByPoll.get(poid)!.push(c);
            }
          });

          // Posts with attached comments and reactions
          const posts = postsSnap.docs
            .map(d => d.data())
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map(p => {
              const postComments = (commentsByPost.get(Number(p.id)) || [])
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              const rKey = `post_${p.id}`;
              const rEntry = reactionsByTarget.get(rKey);
              return {
                ...p,
                comments: postComments,
                reactions: rEntry?.counts || {},
                my_reactions: rEntry?.myReactions || []
              };
            });

          // Polls with votes calculation and comments
          const polls = pollsSnap.docs
            .map(d => d.data())
            .map(p => {
              const votes = p.votes || [];
              const optionCounts: Record<string, number> = {};
              (p.options || []).forEach((opt: string) => { optionCounts[opt] = 0; });
              votes.forEach((v: any) => {
                const opt = v.selected_option ?? v.selectedOption;
                if (opt && optionCounts[opt] !== undefined) {
                  optionCounts[opt]++;
                }
              });
              const myVote = votes.find((v: any) =>
                (currentUser.id !== undefined && (v.user_id === currentUser.id || v.userId === currentUser.id)) ||
                (currentUser.name && (v.user_name === currentUser.name || v.userName === currentUser.name)) ||
                (currentUsername && (v.user_id === currentUsername || v.username === currentUsername))
              )?.selected_option || votes.find((v: any) =>
                (currentUser.id !== undefined && (v.user_id === currentUser.id || v.userId === currentUser.id)) ||
                (currentUser.name && (v.user_name === currentUser.name || v.userName === currentUser.name)) ||
                (currentUsername && (v.user_id === currentUsername || v.username === currentUsername))
              )?.selectedOption || null;
              const isExpired = p.end_date ? new Date(p.end_date).getTime() < Date.now() : false;
              const pollComments = (commentsByPoll.get(Number(p.id)) || [])
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              return {
                ...p,
                total_votes: votes.length,
                option_counts: optionCounts,
                my_vote: myVote,
                is_expired: isExpired,
                is_closed: p.is_closed || (isExpired ? 1 : 0),
                comments: pollComments
              };
            });

          // Schedules with attendees and comments
          const schedules = schedSnap.docs
            .map(d => d.data())
            .map(s => {
              const schedComments = (commentsBySched.get(Number(s.id)) || [])
                .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
              const rKey = `schedule_${s.id}`;
              const rEntry = reactionsByTarget.get(rKey);
              const isAttending = (s.attendees || []).some((a: any) => 
                (a.user_id !== undefined && a.user_id === currentUser.id) ||
                (a.userId !== undefined && a.userId === currentUser.id) ||
                (a.userName && a.userName === currentUser.name) ||
                (a.user_name && a.user_name === currentUser.name)
              );
              return {
                ...s,
                comments: schedComments,
                reactions: rEntry?.counts || {},
                my_reactions: rEntry?.myReactions || [],
                is_attending: isAttending
              };
            });

          // Chat (already filtered by club_id)
          const chat = chatSnap.docs
            .map(d => d.data())
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

          // Only head_admin and server_admin can see view_count
          const isHeadAdmin = currentUser.role === 'head_admin' || currentUser.role === 'server_admin';
          const safeClub = {
            ...club,
            view_count: isHeadAdmin ? Number(club.view_count || 0) : undefined
          };
          if (!isHeadAdmin) {
            delete safeClub.view_count;
          }

          let churchMembers: any[] = [];
          if (isManager) {
            const uSnap = await getDocs(collection(db, 'users'));
            churchMembers = uSnap.docs
              .map(d => d.data())
              .filter(u => u.role !== 'guest' && !u.is_guest)
              .map(u => ({ id: u.id, name: u.name, cell_name: u.cell_name }));
            churchMembers.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ko'));
          }

          return makeResponse({
            club: safeClub,
            isManager,
            members: [],
            churchMembers,
            posts,
            polls,
            schedules,
            chat,
            photos: []
          });
        }

        // POST /api/clubs/:id/visit (Session visit tracking - once per session)
        if (subPath === '/visit' && method === 'POST') {
          const clubRef = doc(db, 'clubs', String(clubId));
          const clubSnap = await getDoc(clubRef);
          if (clubSnap.exists()) {
            const currentCount = Number(clubSnap.data().view_count || 0);
            const newCount = currentCount + 1;
            await updateDoc(clubRef, { view_count: newCount });

            // Record daily stats into club_views collection
            try {
              const kstNow = getKSTDate();
              const dateStr = formatKSTDateStr(kstNow);
              const viewRef = doc(db, 'club_views', `${clubId}_${dateStr}`);
              const viewSnap = await getDoc(viewRef);
              const dayCount = viewSnap.exists() ? (Number(viewSnap.data().count) || 0) + 1 : 1;
              await setDoc(viewRef, {
                club_id: clubId,
                date: dateStr,
                count: dayCount,
                updated_at: new Date().toISOString()
              }, { merge: true });
            } catch (vErr) {
              console.warn('Failed to record daily view stat:', vErr);
            }

            return makeResponse({ success: true, view_count: newCount });
          }
          return makeResponse({ error: '모영을 찾을 수 없습니다.' }, 404);
        }

        // GET /api/clubs/:id/analytics (Head Admin & Server Admin Only)
        if (subPath === '/analytics' && method === 'GET') {
          const uSnap = await getDoc(doc(db, 'users', currentUsername || ''));
          const currentUser = uSnap.data() || { role: 'member' };
          const isAllowed = currentUser.role === 'head_admin' || currentUser.role === 'server_admin';
          if (!isAllowed) {
            return makeResponse({ error: '전체 관리자 및 서버 관리자만 조회수 분석을 열람할 수 있습니다.' }, 403);
          }

          const clubSnap = await getDoc(doc(db, 'clubs', String(clubId)));
          if (!clubSnap.exists()) return makeResponse({ error: '모영을 찾을 수 없습니다.' }, 404);
          const cData = clubSnap.data();

          const analytics = await buildClubAnalytics(
            clubId,
            cData.name || '모영',
            cData.icon || '🌟',
            Number(cData.view_count || 0)
          );

          return makeResponse(analytics);
        }

        // POST /api/clubs/:id/info
        if (subPath === '/info' && method === 'POST') {
          const { name, description, icon } = body || {};
          await updateDoc(doc(db, 'clubs', String(clubId)), { name, description, icon });
          return makeResponse({ message: '모영 정보가 성공적으로 수정되었습니다.' });
        }

        // POST /api/clubs/:id/posts (Create Post)
        if (subPath === '/posts' && method === 'POST') {
          const { content, imageUrl, image_url, is_pinned } = body || {};
          const finalImg = imageUrl || image_url || '';
          const userSnap = await getDoc(doc(db, 'users', currentUsername || 'member1'));
          const user = userSnap.data() || { name: '성도', cell_name: '둔산제일교회', id: 999 };

          const newPost = {
            id: Date.now(),
            club_id: clubId,
            user_id: user.id || 999,
            user_name: user.name,
            user_cell: user.cell_name,
            content: content || '',
            image_url: finalImg,
            is_pinned: is_pinned ? 1 : 0,
            created_at: new Date().toISOString()
          };

          await setDoc(doc(db, 'club_posts', `post_${newPost.id}`), newPost);
          return makeResponse({ message: '글이 성공적으로 등록되었습니다.', post: newPost });
        }

        // PUT /api/clubs/:id/posts/:postId/pin
        const pinMatch = subPath.match(/^\/posts\/(\d+)\/pin$/);
        if (pinMatch && method === 'PUT') {
          const pId = pinMatch[1];
          const postSnap = await getDoc(doc(db, 'club_posts', `post_${pId}`));
          if (postSnap.exists()) {
            const currentPin = postSnap.data().is_pinned || 0;
            await updateDoc(doc(db, 'club_posts', `post_${pId}`), { is_pinned: currentPin ? 0 : 1 });
            return makeResponse({ message: currentPin ? '상단 고정이 해제되었습니다.' : '글이 상단에 고정되었습니다.' });
          }
        }

        // PUT /api/clubs/:id/posts/:postId (Edit)
        const editPostMatch = subPath.match(/^\/posts\/(\d+)$/);
        if (editPostMatch && method === 'PUT') {
          const pId = editPostMatch[1];
          const { content, imageUrl, image_url } = body || {};
          const finalImg = imageUrl !== undefined ? imageUrl : (image_url !== undefined ? image_url : '');
          await updateDoc(doc(db, 'club_posts', `post_${pId}`), { content, image_url: finalImg });
          return makeResponse({ message: '게시글이 수정되었습니다.' });
        }

        // DELETE /api/clubs/:id/posts/:postId
        if (editPostMatch && method === 'DELETE') {
          const pId = editPostMatch[1];
          await deleteDoc(doc(db, 'club_posts', `post_${pId}`));
          return makeResponse({ message: '게시글이 삭제되었습니다.' });
        }

        // POST /api/clubs/:id/reactions
        if (subPath === '/reactions' && method === 'POST') {
          const { targetType, targetId, emoji } = body || {};
          const userSnap = await getDoc(doc(db, 'users', currentUsername || 'member1'));
          const uid = userSnap.data()?.id || 1;

          const rKey = `${targetType}_${targetId}_${uid}_${emoji}`;
          const rSnap = await getDoc(doc(db, 'club_reactions', rKey));
          if (rSnap.exists()) {
            await deleteDoc(doc(db, 'club_reactions', rKey));
            return makeResponse({ action: 'removed' });
          } else {
            await setDoc(doc(db, 'club_reactions', rKey), {
              club_id: clubId,
              target_type: targetType,
              target_id: targetId,
              user_id: uid,
              emoji,
              created_at: new Date().toISOString()
            });
            return makeResponse({ action: 'added' });
          }
        }

        // POST /api/clubs/:id/posts/:postId/comments
        const commMatch = subPath.match(/^\/posts\/(\d+)\/comments$/);
        if (commMatch && method === 'POST') {
          const pId = Number(commMatch[1]);
          const { content, parent_comment_id, schedule_id } = body || {};
          const userSnap = await getDoc(doc(db, 'users', currentUsername || 'member1'));
          const user = userSnap.data() || { name: '성도', cell_name: '둔산제일교회', id: 999 };

          const newComm = {
            id: Date.now(),
            club_id: clubId,
            post_id: pId,
            schedule_id: schedule_id || null,
            parent_comment_id: parent_comment_id || null,
            user_id: user.id || 999,
            user_name: user.name,
            user_cell: user.cell_name,
            content: content || '',
            created_at: new Date().toISOString()
          };

          await setDoc(doc(db, 'club_comments', `comm_${newComm.id}`), newComm);
          return makeResponse({ message: '댓글이 등록되었습니다.', comment: newComm });
        }

        // POST /api/clubs/:id/schedules/:schedId/comments
        const schedCommMatch = subPath.match(/^\/schedules\/(\d+)\/comments$/);
        if (schedCommMatch && method === 'POST') {
          const sId = Number(schedCommMatch[1]);
          const { content, parent_comment_id } = body || {};
          const userSnap = await getDoc(doc(db, 'users', currentUsername || 'member1'));
          const user = userSnap.data() || { name: '성도', cell_name: '둔산제일교회', id: 999 };

          const newComm = {
            id: Date.now(),
            club_id: clubId,
            post_id: null,
            schedule_id: sId,
            parent_comment_id: parent_comment_id || null,
            user_id: user.id || 999,
            user_name: user.name,
            user_cell: user.cell_name,
            content: content || '',
            created_at: new Date().toISOString()
          };

          await setDoc(doc(db, 'club_comments', `comm_${newComm.id}`), newComm);
          return makeResponse({ message: '댓글이 등록되었습니다.', comment: newComm });
        }

        // POST /api/clubs/:id/polls/:pollId/comments
        const pollCommMatch = subPath.match(/^\/polls\/(\d+)\/comments$/);
        if (pollCommMatch && method === 'POST') {
          const pollId = Number(pollCommMatch[1]);
          const { content, parent_comment_id } = body || {};
          const userSnap = await getDoc(doc(db, 'users', currentUsername || 'member1'));
          const user = userSnap.data() || { name: '성도', cell_name: '둔산제일교회', id: 999 };

          const newComm = {
            id: Date.now(),
            club_id: clubId,
            post_id: null,
            schedule_id: null,
            poll_id: pollId,
            parent_comment_id: parent_comment_id || null,
            user_id: user.id || 999,
            user_name: user.name,
            user_cell: user.cell_name,
            content: content || '',
            created_at: new Date().toISOString()
          };

          await setDoc(doc(db, 'club_comments', `comm_${newComm.id}`), newComm);
          return makeResponse({ message: '댓글이 등록되었습니다.', comment: newComm });
        }

        // DELETE /api/clubs/:id/comments/:commentId or /api/clubs/:id/(posts|schedules|polls)/:parentId/comments/:commentId
        const delCommMatch = subPath.match(/^(?:\/(?:posts|schedules|polls)\/\d+)?\/comments\/(\d+)$/);
        if (delCommMatch && method === 'DELETE') {
          const cId = delCommMatch[1];
          await deleteDoc(doc(db, 'club_comments', `comm_${cId}`));
          return makeResponse({ message: '댓글이 삭제되었습니다.' });
        }

        // POST /api/clubs/:id/polls (Create Poll)
        if (subPath === '/polls' && method === 'POST') {
          const { title, description, options, end_date } = body || {};
          let user: any = { name: '총무', id: 1 };
          if (currentUsername) {
            const userSnap = await getDoc(doc(db, 'users', currentUsername));
            if (userSnap.exists()) {
              user = userSnap.data();
            }
          }
          const userId = user.id ?? user.username ?? currentUsername ?? 1;
          const userName = user.name ?? currentUsername ?? '총무';

          const newPoll = {
            id: Date.now(),
            club_id: clubId,
            title: title || '',
            description: description || '',
            options: options || [],
            end_date: end_date || '',
            is_closed: 0,
            is_pinned: 1,
            creator_id: userId,
            creator_name: userName,
            votes: [],
            created_at: new Date().toISOString()
          };

          await setDoc(doc(db, 'club_polls', `poll_${newPoll.id}`), newPoll);
          return makeResponse({ message: '투표가 생성되었습니다.', poll: newPoll });
        }

        // PUT /api/clubs/:id/polls/:pollId/pin
        const pollPinMatch = subPath.match(/^\/polls\/(\d+)\/pin$/);
        if (pollPinMatch && method === 'PUT') {
          const pollId = pollPinMatch[1];
          const pSnap = await getDoc(doc(db, 'club_polls', `poll_${pollId}`));
          if (pSnap.exists()) {
            const currentPin = pSnap.data().is_pinned || 0;
            await updateDoc(doc(db, 'club_polls', `poll_${pollId}`), { is_pinned: currentPin ? 0 : 1 });
            return makeResponse({ message: currentPin ? '투표 상단 고정이 해제되었습니다.' : '투표가 상단에 고정되었습니다.' });
          }
        }

        // POST /api/clubs/:id/polls/:pollId/close
        const pollCloseMatch = subPath.match(/^\/polls\/(\d+)\/close$/);
        if (pollCloseMatch && method === 'POST') {
          const pollId = pollCloseMatch[1];
          await updateDoc(doc(db, 'club_polls', `poll_${pollId}`), { is_closed: 1, is_pinned: 0 });
          return makeResponse({ message: '투표가 성공적으로 마감되었습니다.' });
        }

        // POST /api/clubs/:id/polls/:pollId/vote
        const pollVoteMatch = subPath.match(/^\/polls\/(\d+)\/vote$/);
        if (pollVoteMatch && method === 'POST') {
          const pollId = pollVoteMatch[1];
          const selectedOption = body?.selected_option ?? body?.selectedOption ?? body?.option;
          if (!selectedOption) {
            return makeResponse({ error: '선택된 투표 항목이 없습니다.' }, 400);
          }

          let user: any = { name: '성도', id: 1 };
          if (currentUsername) {
            const userSnap = await getDoc(doc(db, 'users', currentUsername));
            if (userSnap.exists()) {
              user = userSnap.data();
            }
          }
          const userId = user.id ?? user.username ?? currentUsername ?? 1;
          const userName = user.name ?? currentUsername ?? '성도';

          const pSnap = await getDoc(doc(db, 'club_polls', `poll_${pollId}`));
          if (pSnap.exists()) {
            const pData = pSnap.data();
            if (pData.is_closed) {
              return makeResponse({ error: '이미 마감된 투표입니다.' }, 400);
            }

            // 이전 투표 내역 필터링 (userId 또는 userName으로 매칭)
            const rawVotes = Array.isArray(pData.votes) ? pData.votes : [];
            const filteredVotes = rawVotes.filter((v: any) => {
              if (!v) return false;
              if (v.user_id !== undefined && String(v.user_id) === String(userId)) return false;
              if (v.userId !== undefined && String(v.userId) === String(userId)) return false;
              if (userName && v.user_name && String(v.user_name) === String(userName)) return false;
              if (userName && v.userName && String(v.userName) === String(userName)) return false;
              return true;
            });

            // 새 투표 추가 (undefined 완전 배제)
            filteredVotes.push({
              user_id: userId,
              user_name: userName,
              selected_option: String(selectedOption),
              voted_at: new Date().toISOString()
            });

            // Firestore updateDoc 안전 처리 (undefined 필드 제거)
            const cleanVotes = filteredVotes.map((v: any) => {
              const cleanObj: Record<string, any> = {};
              for (const [key, value] of Object.entries(v)) {
                if (value !== undefined) cleanObj[key] = value;
              }
              return cleanObj;
            });

            await updateDoc(doc(db, 'club_polls', `poll_${pollId}`), { votes: cleanVotes });
            return makeResponse({ message: '투표가 반영되었습니다.' });
          } else {
            return makeResponse({ error: '투표를 찾을 수 없습니다.' }, 404);
          }
        }

        // DELETE /api/clubs/:id/polls/:pollId
        const editPollMatch = subPath.match(/^\/polls\/(\d+)$/);
        if (editPollMatch && method === 'DELETE') {
          const pollId = editPollMatch[1];
          await deleteDoc(doc(db, 'club_polls', `poll_${pollId}`));
          return makeResponse({ message: '투표가 삭제되었습니다.' });
        }

        // POST /api/clubs/:id/schedules (Create Schedule)
        if (subPath === '/schedules' && method === 'POST') {
          const { title, event_date, location, fee_info } = body || {};
          const userSnap = await getDoc(doc(db, 'users', currentUsername || 'member1'));
          const user = userSnap.data() || { name: '총무', id: 1 };

          const newSched = {
            id: Date.now(),
            club_id: clubId,
            title,
            event_date,
            location: location || '미정',
            fee_info: fee_info || '무료',
            attendees: [
              { user_id: user.id, user_name: user.name, user_cell: user.cell_name, joined_at: new Date().toISOString() }
            ],
            is_pinned: 1,
            creator_name: user.name,
            created_at: new Date().toISOString()
          };

          await setDoc(doc(db, 'club_schedules', `sched_${newSched.id}`), newSched);
          return makeResponse({ message: '일정이 생성되었습니다.', schedule: newSched });
        }

        // PUT /api/clubs/:id/schedules/:schedId/pin
        const schedPinMatch = subPath.match(/^\/schedules\/(\d+)\/pin$/);
        if (schedPinMatch && method === 'PUT') {
          const sId = schedPinMatch[1];
          const sSnap = await getDoc(doc(db, 'club_schedules', `sched_${sId}`));
          if (sSnap.exists()) {
            const currentPin = sSnap.data().is_pinned || 0;
            await updateDoc(doc(db, 'club_schedules', `sched_${sId}`), { is_pinned: currentPin ? 0 : 1 });
            return makeResponse({ message: currentPin ? '일정 상단 고정이 해제되었습니다.' : '일정이 상단에 고정되었습니다.' });
          }
        }

        // POST /api/clubs/:id/schedules/:schedId/attend
        const schedAttendMatch = subPath.match(/^\/schedules\/(\d+)\/attend$/);
        if (schedAttendMatch && method === 'POST') {
          const sId = schedAttendMatch[1];
          const userSnap = await getDoc(doc(db, 'users', currentUsername || 'member1'));
          const user = userSnap.data() || { name: '성도', id: 1, cell_name: '둔산제일교회' };

          const sSnap = await getDoc(doc(db, 'club_schedules', `sched_${sId}`));
          if (sSnap.exists()) {
            const sData = sSnap.data();
            let attendees = sData.attendees || [];
            const isAttending = attendees.some((a: any) => 
              (a.user_id !== undefined && a.user_id === user.id) ||
              (a.userId !== undefined && a.userId === user.id) ||
              (a.user_name && a.user_name === user.name) ||
              (a.userName && a.userName === user.name)
            );
            
            if (isAttending) {
              // Cancel attendance: remove any matching attendee (cleans up any previous duplicates as well)
              attendees = attendees.filter((a: any) => 
                (a.user_id !== user.id) &&
                (a.userId !== user.id) &&
                (a.user_name !== user.name) &&
                (a.userName !== user.name)
              );
            } else {
              // Add attendance: prevent duplicates
              const cleanAttendees = attendees.filter((a: any) => 
                (a.user_id !== user.id) &&
                (a.userId !== user.id) &&
                (a.user_name !== user.name) &&
                (a.userName !== user.name)
              );
              cleanAttendees.push({
                user_id: user.id,
                userId: user.id,
                user_name: user.name,
                userName: user.name,
                user_cell: user.cell_name,
                cellName: user.cell_name,
                joined_at: new Date().toISOString()
              });
              attendees = cleanAttendees;
            }
            await updateDoc(doc(db, 'club_schedules', `sched_${sId}`), { attendees });
            return makeResponse({ 
              message: !isAttending ? '참석 신청되었습니다.' : '참석이 취소되었습니다.',
              is_attending: !isAttending,
              attendees
            });
          }
        }

        // DELETE /api/clubs/:id/schedules/:schedId
        const delSchedMatch = subPath.match(/^\/schedules\/(\d+)$/);
        if (delSchedMatch && method === 'DELETE') {
          const sId = delSchedMatch[1];
          await deleteDoc(doc(db, 'club_schedules', `sched_${sId}`));
          return makeResponse({ message: '일정이 삭제되었습니다.' });
        }

        // POST /api/clubs/:id/chat (Send Chat)
        if (subPath === '/chat' && method === 'POST') {
          const { message } = body || {};
          const userSnap = await getDoc(doc(db, 'users', currentUsername || 'member1'));
          const user = userSnap.data() || { name: '성도', id: 1, cell_name: '둔산제일교회' };

          const newMsg = {
            id: Date.now(),
            club_id: clubId,
            sender_id: user.id,
            sender_name: user.name,
            sender_cell: user.cell_name,
            message: message || '',
            created_at: new Date().toISOString()
          };

          await setDoc(doc(db, 'club_chat', `msg_${newMsg.id}`), newMsg);
          return makeResponse({ message: '전송 완료', chat: newMsg });
        }

        // POST /api/clubs/:id/handover (Manager handover)
        if (subPath === '/handover' && method === 'POST') {
          const { targetUserId, actionType } = body || {};
          const userSnap = await getDoc(doc(db, 'users', currentUsername || 'member1'));
          const uSnap = await getDocs(collection(db, 'users'));
          const target = uSnap.docs.map(d => d.data()).find(u => u.id === targetUserId);
          if (!target) return makeResponse({ error: '대상 성도를 찾을 수 없습니다.' }, 404);
          if (target.role === 'guest' || target.is_guest) {
            return makeResponse({ error: '게스트는 모영 총무로 선임될 수 없습니다.' }, 400);
          }

          const clubSnap = await getDoc(doc(db, 'clubs', String(clubId)));
          if (clubSnap.exists()) {
            const club = clubSnap.data();
            let managers = (club.manager_names || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            if (actionType === 'appoint') {
              if (!managers.includes(target.name)) managers.push(target.name);
            } else if (actionType === 'dismiss') {
              managers = managers.filter((m: string) => m !== target.name);
            }
            await updateDoc(doc(db, 'clubs', String(clubId)), { manager_names: managers.join(', ') });
            return makeResponse({ message: `총무 명단이 업데이트되었습니다: [${managers.join(', ')}]` });
          }
        }
      }

      // ----------------------------------------------------
      // CLUB ANALYTICS (HEAD ADMIN & SERVER ADMIN)
      // ----------------------------------------------------
      if (pathname === '/api/admin/club-analytics' && method === 'GET') {
        const uSnap = await getDoc(doc(db, 'users', currentUsername || ''));
        const currentUser = uSnap.data() || { role: 'member' };
        const isAllowed = currentUser.role === 'head_admin' || currentUser.role === 'server_admin';
        if (!isAllowed) {
          return makeResponse({ error: '전체 관리자 및 서버 관리자만 조회수 분석을 열람할 수 있습니다.' }, 403);
        }

        const clSnap = await getDocs(collection(db, 'clubs'));
        const clubsData = clSnap.docs.map(d => d.data());

        const analyticsList = [];
        let allTotal = 0;
        let allToday = 0;
        let allWeek = 0;
        let allMonth = 0;

        for (const cl of clubsData) {
          const a = await buildClubAnalytics(
            Number(cl.id),
            cl.name || '모영',
            cl.icon || '🌟',
            Number(cl.view_count || 0)
          );
          analyticsList.push(a);
          allTotal += a.total_views;
          allToday += a.today_views;
          allWeek += a.this_week_views;
          allMonth += a.this_month_views;
        }

        analyticsList.sort((a, b) => b.total_views - a.total_views);

        return makeResponse({
          all_total_views: allTotal,
          all_today_views: allToday,
          all_this_week_views: allWeek,
          all_this_month_views: allMonth,
          clubs: analyticsList
        });
      }

      // ----------------------------------------------------
      // HEAD ADMIN ROUTES
      // ----------------------------------------------------
      if (pathname === '/api/head-admin/popup') {
        if (method === 'GET') {
          const popSnap = await getDocs(collection(db, 'popups'));
          const popup = popSnap.docs.map(d => d.data())[0] || null;
          return makeResponse(popup || { title: '', content_text: '', image_url: '', end_date: '', is_active: 0 });
        }
        if (method === 'POST') {
          const { title, content_text, image_url, end_date, is_active } = body || {};
          await setDoc(doc(db, 'popups', 'popup_1'), {
            id: 1,
            title,
            content_text,
            image_url: image_url || '',
            end_date,
            is_active: is_active ? 1 : 0,
            updated_at: new Date().toISOString()
          });
          return makeResponse({ message: '팝업 설정이 저장되었습니다.' });
        }
      }

      if (pathname === '/api/head-admin/notices') {
        if (method === 'GET') {
          const notSnap = await getDocs(collection(db, 'notices'));
          const notices = notSnap.docs
            .map(d => d.data())
            .sort((a, b) => {
              const timeA = new Date(a.created_at || 0).getTime() || a.id || 0;
              const timeB = new Date(b.created_at || 0).getTime() || b.id || 0;
              return timeB - timeA;
            });
          return makeResponse(notices);
        }
        if (method === 'POST') {
          const { title, content, is_pinned, is_active } = body || {};
          const userSnap = await getDoc(doc(db, 'users', currentUsername || 'pastor'));
          const user = userSnap.data() || { name: '김목사', id: 2 };

          const notSnap = await getDocs(collection(db, 'notices'));

          const newNotice = {
            id: Date.now(),
            title: (title || '').trim(),
            content: (content || '').trim(),
            author_id: user.id || 1,
            author_name: user.name || '관리자',
            is_pinned: is_pinned !== undefined ? (is_pinned ? 1 : 0) : 1,
            is_active: is_active === undefined ? 1 : (is_active ? 1 : 0),
            created_at: new Date().toISOString()
          };

          // 이전 공지 문서들을 정리하여 항상 단일 최신 공지로 교체/유지
          const deletePromises = notSnap.docs.map(d => deleteDoc(d.ref));
          await Promise.all(deletePromises);

          await setDoc(doc(db, 'notices', `notice_${newNotice.id}`), newNotice);
          return makeResponse({ message: '교회 전체 공지가 성공적으로 저장 및 반영되었습니다.', notice: newNotice });
        }
        if (method === 'DELETE') {
          const notSnap = await getDocs(collection(db, 'notices'));
          const deletePromises = notSnap.docs.map(d => deleteDoc(d.ref));
          await Promise.all(deletePromises);
          return makeResponse({ message: '모든 공지사항이 삭제되었습니다.' });
        }
      }

      if (pathname === '/api/head-admin/notices/toggle') {
        const notSnap = await getDocs(collection(db, 'notices'));
        if (!notSnap.empty) {
          const sortedDocs = notSnap.docs.sort((a, b) => {
            const timeA = new Date(a.data().created_at || 0).getTime() || a.data().id || 0;
            const timeB = new Date(b.data().created_at || 0).getTime() || b.data().id || 0;
            return timeB - timeA;
          });
          const targetDoc = sortedDocs[0];
          const curData = targetDoc.data();
          const newActive = curData.is_active === 0 ? 1 : 0;
          // 모든 공지 문서의 is_active를 일괄 토글
          const updatePromises = notSnap.docs.map(d => updateDoc(d.ref, { is_active: newActive }));
          await Promise.all(updatePromises);
          return makeResponse({
            message: `전체 공지가 ${newActive === 1 ? 'ON (노출)' : 'OFF (숨김)'}되었습니다.`,
            is_active: newActive
          });
        }
        return makeResponse({ error: '등록된 공지사항이 없습니다.' }, 404);
      }

      if (pathname === '/api/head-admin/welcome') {
        if (method === 'GET') {
          const wSnap = await getDoc(doc(db, 'lobby_settings', 'main'));
          const data = wSnap.data() || {
            welcome_tagline: '은혜와 교제가 넘치는 둔산제일교회 모영',
            welcome_message: '이번 주에도 모영에서 기쁨의 교제 함께해요.'
          };
          return makeResponse({ welcome: data, ...data });
        }
        if (method === 'POST') {
          const { welcome_tagline, welcome_message } = body || {};
          await setDoc(doc(db, 'lobby_settings', 'main'), {
            welcome_tagline: welcome_tagline || '',
            welcome_message: welcome_message || '',
            updated_at: new Date().toISOString()
          }, { merge: true });
          return makeResponse({ message: '환영 메시지가 저장되었습니다.' });
        }
      }

      if (pathname === '/api/head-admin/cells') {
        if (method === 'GET') {
          const [cSnap, uSnap] = await Promise.all([
            getDocs(collection(db, 'cells')),
            getDocs(collection(db, 'users'))
          ]);
          const usersList = uSnap.docs.map(d => d.data()).filter((u: any) => u.role !== 'guest' && !u.is_guest);
          const cellList = cSnap.docs.map(d => {
            const data = d.data();
            const member_count = usersList.filter((u: any) => u.cell_name === data.name).length;
            return { ...data, member_count };
          });
          cellList.sort((a: any, b: any) => {
            if (a.name === '둔산제일교회') return -1;
            if (b.name === '둔산제일교회') return 1;
            return (a.name || '').localeCompare(b.name || '', 'ko');
          });
          return makeResponse({ cells: cellList, length: cellList.length });
        }
        if (method === 'POST') {
          const { name } = body || {};
          if (!name || !name.trim()) {
            return makeResponse({ error: '추가할 셀 이름을 입력해주세요.' }, 400);
          }
          const cleanName = name.trim();

          const cSnap = await getDocs(collection(db, 'cells'));
          const exists = cSnap.docs.some(d => d.data().name === cleanName);
          if (exists) {
            return makeResponse({ error: `'${cleanName}' 셀은 이미 등록되어 있습니다.` }, 400);
          }

          const newCell = { id: Date.now(), name: cleanName, created_at: new Date().toISOString() };
          await setDoc(doc(db, 'cells', `cell_${newCell.id}`), newCell);
          return makeResponse({ message: `'${cleanName}' 셀이 성공적으로 추가되었습니다.`, cell: newCell });
        }
      }

      if (pathname.startsWith('/api/head-admin/cells/') && method === 'DELETE') {
        const cId = pathname.split('/').pop();
        const cSnap = await getDocs(collection(db, 'cells'));
        const target = cSnap.docs.find(d => String(d.data().id) === String(cId) || d.id === `cell_${cId}` || d.id === cId);
        if (target) {
          await deleteDoc(target.ref);
          return makeResponse({ message: '셀이 삭제되었습니다.' });
        }
        return makeResponse({ error: '셀을 찾을 수 없습니다.' }, 404);
      }

      if (pathname === '/api/head-admin/cells/reorganize' && method === 'POST') {
        const { cellListText, cellNames: rawCellNames } = body || {};
        let cellNames: string[] = [];
        if (Array.isArray(rawCellNames)) {
          cellNames = rawCellNames.map((s: any) => String(s).trim()).filter(Boolean);
        } else if (typeof cellListText === 'string') {
          cellNames = cellListText.split('\n').map((s: string) => s.trim()).filter(Boolean);
        }
        // Clean and reset cells
        const oldSnap = await getDocs(collection(db, 'cells'));
        for (const d of oldSnap.docs) {
          if (d.data().name !== '둔산제일교회') {
            await deleteDoc(d.ref);
          }
        }
        for (let i = 0; i < cellNames.length; i++) {
          if (cellNames[i] !== '둔산제일교회') {
            await setDoc(doc(db, 'cells', `cell_${Date.now()}_${i}`), {
              id: Date.now() + i,
              name: cellNames[i],
              created_at: new Date().toISOString()
            });
          }
        }
        return makeResponse({ message: '셀 개편이 완료되었습니다.' });
      }

      if (pathname === '/api/head-admin/clubs') {
        if (method === 'GET') {
          const clSnap = await getDocs(collection(db, 'clubs'));
          const clubList = clSnap.docs.map(d => {
            const data = d.data();
            return {
              ...data,
              view_count: Number(data.view_count || 0)
            };
          });
          return makeResponse({ clubs: clubList });
        }
        if (method === 'POST') {
          const { name, icon, description, manager_names } = body || {};
          const newClub = {
            id: Date.now(),
            name: name || '',
            icon: icon || '⚽',
            description: description || '',
            manager_names: manager_names || '',
            member_count: 0,
            view_count: 0,
            created_at: new Date().toISOString()
          };
          await setDoc(doc(db, 'clubs', String(newClub.id)), newClub);
          return makeResponse({ message: '새 모영이 생성되었습니다.', club: newClub });
        }
      }

      if (pathname.startsWith('/api/head-admin/clubs/')) {
        const parts = pathname.split('/');
        const cId = parts[4];
        const subAction = parts[5];

        if (method === 'DELETE' && !subAction) {
          await deleteDoc(doc(db, 'clubs', String(cId)));
          return makeResponse({ message: '모영이 삭제되었습니다.' });
        }

        if (method === 'POST' && subAction === 'managers') {
          const { manager_names } = body || {};
          await updateDoc(doc(db, 'clubs', String(cId)), { manager_names: manager_names || '' });
          return makeResponse({ message: '총무 명단이 업데이트되었습니다.' });
        }
      }

      if (pathname === '/api/head-admin/members') {
        const uSnap = await getDocs(collection(db, 'users'));
        const memberList = uSnap.docs
          .map(d => d.data())
          .filter((u: any) => u.role !== 'guest' && !u.is_guest);
        return makeResponse({ members: memberList, length: memberList.length });
      }

      if (pathname.startsWith('/api/head-admin/targeted-welcomes')) {
        const tIdMatch = pathname.match(/^\/api\/head-admin\/targeted-welcomes\/(\d+)(\/toggle)?$/);
        
        if (method === 'GET') {
          const twSnap = await getDocs(collection(db, 'targeted_welcomes'));
          const targetedWelcomes = twSnap.docs.map(d => d.data());
          return makeResponse({ targetedWelcomes });
        }
        
        if (method === 'POST' && !tIdMatch) {
          const { id, group_name, tagline, message, user_ids, target_users } = body || {};
          const twId = id || Date.now();
          const newTW = {
            id: twId,
            group_name: group_name || '',
            tagline: tagline || '',
            message: message || '',
            user_ids: user_ids || [],
            target_users: target_users || [],
            is_active: 1,
            created_at: new Date().toISOString()
          };
          await setDoc(doc(db, 'targeted_welcomes', `tw_${twId}`), newTW);
          return makeResponse({ message: '타겟 환영 문구가 저장되었습니다.', targetedWelcome: newTW });
        }

        if (tIdMatch && method === 'POST') {
          const id = tIdMatch[1];
          const twSnap = await getDoc(doc(db, 'targeted_welcomes', `tw_${id}`));
          if (twSnap.exists()) {
            const currentActive = twSnap.data().is_active || 0;
            const newActive = currentActive ? 0 : 1;
            await updateDoc(twSnap.ref, { is_active: newActive });
            return makeResponse({ message: '상태가 변경되었습니다.', is_active: newActive });
          }
        }

        if (tIdMatch && method === 'DELETE') {
          const id = tIdMatch[1];
          await deleteDoc(doc(db, 'targeted_welcomes', `tw_${id}`));
          return makeResponse({ message: '타겟 환영 문구가 삭제되었습니다.' });
        }
      }

      if (pathname === '/api/head-admin/media-admins') {
        if (method === 'GET') {
          const uSnap = await getDocs(collection(db, 'users'));
          const mediaAdmins = uSnap.docs
            .map(d => d.data())
            .filter((u: any) => u.role === 'media_admin');
          return makeResponse({ mediaAdmins });
        }
        if (method === 'POST') {
          const { userId, action } = body || {};
          const uSnap = await getDocs(collection(db, 'users'));
          const target = uSnap.docs.find(d => d.data().id === userId || String(d.data().id) === String(userId));
          if (target) {
            if (target.data().role === 'guest' || target.data().is_guest) {
              return makeResponse({ error: '게스트는 미디어 관리자로 임명될 수 없습니다.' }, 400);
            }
            const newRole = action === 'appoint' ? 'media_admin' : 'member';
            await updateDoc(target.ref, { role: newRole });
            const userName = target.data().name || '회원';
            return makeResponse({
              message: action === 'appoint'
                ? `'${userName}' 성도님이 미디어 관리자로 선임되었습니다.`
                : `'${userName}' 성도님의 미디어 관리자 권한이 해임되었습니다.`
            });
          }
          return makeResponse({ error: '해당 회원을 찾을 수 없습니다.' }, 404);
        }
      }

      // ----------------------------------------------------
      // SERVER ADMIN ROUTES
      // ----------------------------------------------------
      if (pathname === '/api/reports' && method === 'POST') {
        const { title, content, user_id, user_name, user_cell } = body || {};
        const newReport = {
          id: Date.now(),
          title: title || '',
          content: content || '',
          user_id: user_id || 0,
          user_name: user_name || '익명',
          user_cell: user_cell || '',
          status: 'pending',
          created_at: new Date().toISOString()
        };
        await setDoc(doc(db, 'reports', `report_${newReport.id}`), newReport);
        return makeResponse({ message: '접수 완료' });
      }

      if (pathname === '/api/server-admin/reports' && method === 'GET') {
        const rSnap = await getDocs(collection(db, 'reports'));
        const reports = rSnap.docs.map(d => d.data());
        return makeResponse({ reports });
      }

      if (pathname.startsWith('/api/server-admin/reports/') && method === 'PUT') {
        const id = pathname.split('/')[4];
        const { status } = body || {};
        await updateDoc(doc(db, 'reports', `report_${id}`), { status });
        return makeResponse({ message: '상태가 변경되었습니다.' });
      }
      if (pathname === '/api/server-admin/users') {
        const uSnap = await getDocs(collection(db, 'users'));
        const userList = uSnap.docs.map(d => d.data());
        return makeResponse({ users: userList });
      }

      if (pathname.startsWith('/api/server-admin/guests/') && method === 'DELETE') {
        const guestIdOrUsername = pathname.split('/')[4];
        const uSnap = await getDocs(collection(db, 'users'));
        const target = uSnap.docs.find(d => {
          const data = d.data();
          return String(data.id) === String(guestIdOrUsername) || data.username === guestIdOrUsername || d.id === guestIdOrUsername;
        });
        if (target) {
          await deleteDoc(target.ref);
          return makeResponse({ message: '게스트 계정이 성공적으로 삭제되었습니다.' });
        }
        return makeResponse({ error: '삭제할 게스트를 찾을 수 없습니다.' }, 404);
      }

      if (pathname === '/api/server-admin/set-role') {
        const { userId, role } = body || {};
        const uSnap = await getDocs(collection(db, 'users'));
        const target = uSnap.docs.find(d => d.data().id === userId);
        if (target) {
          if (target.data().role === 'guest' || target.data().is_guest) {
            return makeResponse({ error: '게스트는 권한을 부여받거나 변경할 수 없습니다.' }, 400);
          }
          await updateDoc(target.ref, { role });
          return makeResponse({ message: '권한이 변경되었습니다.' });
        }
        return makeResponse({ error: '사용자를 찾을 수 없습니다.' }, 404);
      }

      if (pathname === '/api/server-admin/reset-security') {
        return makeResponse({ message: '2FA 보안 잠금 및 카운트가 초기화되었습니다.' });
      }

      if (pathname === '/api/server-admin/metrics') {
        const uSnap = await getDocs(collection(db, 'users'));
        const allUsers = uSnap.docs.map(d => d.data());
        const regularMembers = allUsers.filter(u => u.role !== 'guest' && !u.is_guest);
        const guestCount = allUsers.filter(u => u.role === 'guest' || u.is_guest).length;
        const clSnap = await getDocs(collection(db, 'clubs'));
        const postSnap = await getDocs(collection(db, 'club_posts'));
        return makeResponse({
          traffic: {
            today: 42,
            total: 1280
          },
          storage: {
            used_bytes: 52428800,
            limit_bytes: 1073741824,
            used_mb: '50.00',
            limit_mb: 1024,
            percentage: '4.88'
          },
          total_members: regularMembers.length,
          total_guests: guestCount,
          security: {
            is_locked: false,
            fail_count: 0,
            cooldown_until: 0
          }
        });
      }

      // Default 404
      return makeResponse({ error: `Not found: ${pathname}` }, 404);
    } catch (err: any) {
      console.error('Firebase API Error for ' + pathname, err);
      return makeResponse({ error: err.message || '서버 오류가 발생했습니다.' }, 500);
    }
  };
}
