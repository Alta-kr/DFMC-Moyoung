import { readLegacyFeedPage } from '../lib/legacyFeedReader.js';
import { setLegacyManagers, proposeHandover, agreeHandover, pendingHandovers } from '../lib/legacyManagers.js';
import { samePerson, isClubManager } from '../lib/identity.js';
import { saveLegacyParticipation } from '../lib/legacyParticipation.js';
import { parseMoyoungDate, scheduleTimes } from '../src/dateTime.js';
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
  orderBy, runTransaction
} from '../src/adminFirestore.js';

// Helper to make JSON Response
function makeResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
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

async function buildClubAnalytics(db: any, clubId: number, clubName: string, clubIcon: string, totalViews: number) {
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

// 로그인한 회원이 대상인 활성 맞춤 환영 문구가 있으면 전체 문구 대신 돌려준다.
async function welcomeFor(db: any, user: any, fallback: any) {
  if (!user?.id) return fallback;
  const snap = await getDocs(query(collection(db, 'targeted_welcomes'), where('user_ids', 'array-contains', user.id)));
  const item = snap.docs.map((d: any) => d.data()).filter((tw: any) => tw.is_active === 1 || tw.is_active === true)
    .sort((a: any, b: any) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0];
  if (!item) return fallback;
  return { welcome_tagline: item.welcome_tagline ?? item.tagline ?? '', welcome_message: item.welcome_message ?? item.message ?? '',
    group_name: item.group_name || '', is_targeted: true };
}

export async function handleLegacyApi(db: any, requestUrl: URL, method: string, body: any, currentUsername: string | null) {
    const pathname = requestUrl.pathname;
    try {
      // Server-owned session identity; never accept an actor from request JSON.
      const actorDoc = currentUsername ? await getDoc(doc(db, 'users', currentUsername)) : null;
      const actor = actorDoc?.exists() ? actorDoc.data() : null;
      if (pathname.startsWith('/api/server-admin/') && actor?.role !== 'server_admin') return makeResponse({ error: '서버관리자 권한이 필요합니다.' }, 403);
      if (pathname.startsWith('/api/head-admin/')) {
        // 미디어 관리자는 맞춤 환영 대상 선택을 위해 회원 목록 조회만 추가로 허용한다.
        const mediaPath = /^\/api\/head-admin\/(popup|notices|welcome|targeted-welcomes)(\/|$)/.test(pathname) || (pathname === '/api/head-admin/members' && method === 'GET');
        if (!actor || !(['server_admin', 'head_admin'].includes(actor.role) || (mediaPath && actor.role === 'media_admin'))) return makeResponse({ error: '관리자 권한이 필요합니다.' }, 403);
      }
      const guardedClub = pathname.match(/^\/api\/clubs\/(\d+)(.*)$/);
      if (guardedClub) {
        const part = guardedClub[2];
        if (!actor) return makeResponse({ error: '로그인이 필요합니다.' }, 401);
        if (!(await getDoc(doc(db,'clubs',guardedClub[1]))).exists()) return makeResponse({error:'모영을 찾을 수 없습니다.'},404);
        if (part === '/handover' && !['head_admin','server_admin'].includes(actor.role)) return makeResponse({error:'총무 변경은 인계 안건으로 진행해주세요.'},403);
        if ((actor.role === 'guest' || actor.is_guest) && !(/^\/schedules\/\d+\/attend$/.test(part) && method === 'POST')) return makeResponse({ error: '게스트는 홈 일정 참석만 가능합니다.' }, 403);
        const item=part.match(/^\/(posts|polls|schedules)\/(\d+)/);
        if(item && method!=='GET') {
          const source={posts:['club_posts','post_'],polls:['club_polls','poll_'],schedules:['club_schedules','sched_']}[item[1]]!;
          const target=await getDoc(doc(db,source[0],source[1]+item[2]));
          if(!target.exists() || Number(target.data().club_id ?? target.data().clubId)!==Number(guardedClub[1])) return makeResponse({error:'다른 모임의 항목입니다.'},403);
          if(item[1]==='posts' && /^\/posts\/\d+$/.test(part) && !samePerson(target.data(),actor) && !['media_admin','head_admin','server_admin'].includes(actor.role)) return makeResponse({error:'게시글 변경 권한이 없습니다.'},403);
        }
        const managerAction = part === '/info' || part.startsWith('/handover') || part === '/schedules' || part === '/polls' || /\/(pin|close)$/.test(part) || (/^\/(schedules|polls)\/\d+$/.test(part) && method !== 'GET');
        if (method !== 'GET' && managerAction) {
          const club = await getDoc(doc(db, 'clubs', guardedClub[1]));
          if (!club.exists() || !isClubManager(club.data(), actor)) return makeResponse({ error: '모영 총무 권한이 필요합니다.' }, 403);
        }
      }
      // ----------------------------------------------------
      // LOBBY ROUTES
      // ----------------------------------------------------
      if (pathname === '/api/lobby/data') {
        const summary=await getDoc(doc(db,'_readModels','lobby'));
        if(summary.data()?.version===1) {
          const result=summary.data()!;
          const profile=currentUsername?await getDoc(doc(db,'users',currentUsername)):null;
          const user=profile?.data();
          const schedules=await Promise.all((result.schedules || []).map(async (schedule:any)=>{
            if(!user) return schedule;
            const source=await getDoc(doc(db,'club_schedules',schedule.sourceId));
            return {...schedule,is_attending:(source.data()?.attendees || []).some((entry:any)=>samePerson(entry,user))};
          }));
          const welcome=await welcomeFor(db,user,result.welcome);
          return makeResponse({...result,schedules,highlightedSchedules:schedules,welcome,welcomeMessage:welcome});
        }
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

        const parseSchedTimestamp = (dateStr?: string): number => parseMoyoungDate(dateStr) ?? NaN;

        // 모영별(모영 이름 기준)로 일정 그룹화하여 각 모영당 가장 임박한 1개만 선정
        const schedulesByClub = new Map<string, any[]>();
        schedSnap.docs.forEach(d => {
          const s = d.data();
          const t = parseSchedTimestamp(s.event_date);
          if (isNaN(t) || t < threshold) return;

          // 해당 일정이 속한 모영 찾기
          let cl = clubs.find(c => Number(c.id) === Number(s.club_id) || String(c.id) === String(s.club_id));

          if (!cl) return; // 모영이 존재하지 않는 고아 일정은 홈 화면에 표시하지 않음

          const clubKey = String(cl.id);
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
          const isAttending = attendees.some((a: any) => samePerson(a, currentUser));
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
        const welcomeMessage = await welcomeFor(db, uSnap?.data(), welcomeSnap && welcomeSnap.exists()
          ? welcomeSnap.data()
          : { welcome_tagline: '은혜와 교제가 넘치는 둔산제일교회 모영', welcome_message: '이번 주에도 모영에서 기쁨의 교제 함께해요.' });

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
        const newCellName = body?.newCellName ?? body?.new_cell_name ?? body?.cell_name ?? body?.cellName;
        if (!currentUsername) return makeResponse({ error: '로그인이 필요합니다.' }, 401);
        if (typeof newCellName !== 'string' || !newCellName.trim()) return makeResponse({ error: '변경할 셀 이름을 입력해주세요.' }, 400);

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
        return makeResponse({ error: '사진 업로드 기능이 종료되었습니다.' }, 410);
      }

      // ----------------------------------------------------
      // CLUBS ROUTES
      // ----------------------------------------------------
      const clubMatch = pathname.match(/^\/api\/clubs\/(\d+)(.*)$/);
      if (clubMatch) {
        const clubId = Number(clubMatch[1]);
        const subPath = clubMatch[2];

        if(subPath==='/members' && method==='GET') {
          const club=await getDoc(doc(db,'clubs',String(clubId)));
          if(!club.exists() || !isClubManager(club.data(),actor)) return makeResponse({error:'총무 권한이 필요합니다.'},403);
          const users=await getDocs(collection(db,'users'));
          return makeResponse({members:users.docs.map(d=>d.data()).filter(u=>u.role!=='guest'&&!u.is_guest).map(u=>({id:u.id,name:u.name,cell_name:u.cell_name??''})).sort((a,b)=>a.name.localeCompare(b.name,'ko'))});
        }
        // GET /api/clubs/:id
        if (!subPath && method === 'GET') {
          const clubSnap = await getDoc(doc(db, 'clubs', String(clubId)));
          if (!clubSnap.exists()) return makeResponse({ error: '모영을 찾을 수 없습니다.' }, 404);
          const club = clubSnap.data();

          // Current User details
          const uSnap = await getDoc(doc(db, 'users', currentUsername || ''));
          const currentUser = uSnap.data() || { id: 999, name: '', role: 'member' };
          const isManager = isClubManager(club, currentUser);

          // Use where() queries to only fetch data for THIS club
          const clubIdFilter = where('club_id', '==', clubId);
          const page = club.feedReadModelVersion === 1 ? await readLegacyFeedPage(db,clubId,requestUrl.searchParams.get('cursor')) : null;
          const [commSnap, reactSnap, postsSnap, pollsSnap, schedSnap, chatSnap] = page ? [page.commSnap,page.reactSnap,page.postsSnap,page.pollsSnap,page.schedSnap,page.chatSnap] : await Promise.all([
            getDocs(query(collection(db, 'club_comments'), clubIdFilter)),
            getDocs(query(collection(db, 'club_reactions'),clubIdFilter)),
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
              const selectedVote = votes.find((v: any) => samePerson(v, currentUser));
              const myVote = selectedVote?.selected_option ?? selectedVote?.selectedOption ?? null;
              const isExpired = (parseMoyoungDate(p.closesAtMs ?? p.end_date, true) ?? 0) <= Date.now();
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
              const isAttending = (s.attendees || []).some((a: any) => samePerson(a, currentUser));
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

          const churchMembers: any[] = [];
          const handoverVotes = isManager ? await pendingHandovers(db, clubId, currentUser) : [];

          return makeResponse({
            paginated: !!page, nextCursor: page?.nextCursor ?? null,
            club: safeClub,
            isManager,
            handoverVotes,
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
            db,            clubId,
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
          if (imageUrl || image_url) return makeResponse({ error: '새 사진은 첨부할 수 없습니다.' }, 400);
          const finalImg = '';
          const userSnap = await getDoc(doc(db, 'users', currentUsername || 'member1'));
          const user = userSnap.data() || { name: '성도', cell_name: '둔산제일교회', id: 999 };
          // 화면과 같이 총무와 전체·서버 관리자만 글을 쓸 수 있다.
          if (!isClubManager((await getDoc(doc(db,'clubs',String(clubId)))).data(),user)) return makeResponse({ error: '모영 총무만 글을 쓸 수 있습니다.' }, 403);

          const newPost = {
            feedSchemaVersion: 1, feedClubId: String(clubId),
            id: Date.now(),
            club_id: clubId,
            user_id: user.id || 999,
            user_name: user.name ?? '회원',
            user_cell: user.cell_name ?? '',
            content: content || '',
            image_url: finalImg,
            is_pinned: is_pinned && isClubManager((await getDoc(doc(db,'clubs',String(clubId)))).data(),user) ? 1 : 0,
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
          const oldPost = await getDoc(doc(db, 'club_posts', 'post_' + pId));
          if (!oldPost.exists()) return makeResponse({ error: '글을 찾을 수 없습니다.' }, 404);
          const finalImg = imageUrl ?? image_url ?? oldPost.data().image_url ?? '';
          if (finalImg && finalImg !== oldPost.data().image_url) return makeResponse({ error: '새 사진은 첨부할 수 없습니다.' }, 400);
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
          const source = {post:['club_posts','post_'],poll:['club_polls','poll_'],schedule:['club_schedules','sched_'],comment:['club_comments','comm_']}[targetType];
          if (!source || !/^\d+$/.test(String(targetId)) || typeof emoji !== 'string' || emoji.length > 20 || !emoji) return makeResponse({error:'반응 대상을 확인해주세요.'},400);
          const target = await getDoc(doc(db,source[0],source[1]+targetId));
          if (!target.exists() || Number(target.data().club_id ?? target.data().clubId) !== clubId) return makeResponse({error:'다른 모임의 항목입니다.'},403);
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
            user_name: user.name ?? '회원',
            user_cell: user.cell_name ?? '',
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
            user_name: user.name ?? '회원',
            user_cell: user.cell_name ?? '',
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
            user_name: user.name ?? '회원',
            user_cell: user.cell_name ?? '',
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
          const comment=await getDoc(doc(db,'club_comments',`comm_${cId}`));
          if(!comment.exists() || Number(comment.data().club_id)!==clubId) return makeResponse({error:'댓글을 찾을 수 없습니다.'},404);
          // 작성자, 해당 모영 총무, 미디어·전체·서버 관리자가 삭제할 수 있다.
          const canModerate=['media_admin','head_admin','server_admin'].includes(actor?.role) || isClubManager((await getDoc(doc(db,'clubs',String(clubId)))).data(),actor);
          if(!samePerson(comment.data(),actor) && !canModerate) return makeResponse({error:'댓글 삭제 권한이 없습니다.'},403);
          await deleteDoc(comment.ref);
          return makeResponse({ message: '댓글이 삭제되었습니다.' });
        }

        // POST /api/clubs/:id/polls (Create Poll)
        if (subPath === '/polls' && method === 'POST') {
          const {title,description,options}=body || {};
          const end_date=body?.end_date ?? body?.endDate;
          if(typeof title!=='string' || !title.trim() || !Array.isArray(options) || options.length<2 || options.some((option:any)=>typeof option!=='string'||!option.trim()) || new Set(options).size!==options.length) return makeResponse({error:'투표 제목과 서로 다른 선택지를 입력해주세요.'},400);
          let user: any = { name: '총무', id: 1 };
          if (currentUsername) {
            const userSnap = await getDoc(doc(db, 'users', currentUsername));
            if (userSnap.exists()) {
              user = userSnap.data();
            }
          }
          const userId = user.id ?? user.username ?? currentUsername ?? 1;
          const userName = user.name ?? currentUsername ?? '총무';

          const closesAtMs = parseMoyoungDate(end_date, true);
          if (closesAtMs === null || closesAtMs <= Date.now()) return makeResponse({ error: '투표 마감 시각을 확인해주세요.' }, 400);
          const newPoll = {
            feedSchemaVersion: 1, feedClubId: String(clubId),
            closesAtMs,
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
        if (pollCloseMatch && ['POST','PUT'].includes(method)) {
          const pollId = pollCloseMatch[1];
          await updateDoc(doc(db, 'club_polls', `poll_${pollId}`), { is_closed: 1, is_pinned: 0 });
          return makeResponse({ message: '투표가 성공적으로 마감되었습니다.' });
        }

        // POST /api/clubs/:id/polls/:pollId/vote
        const pollVoteMatch = subPath.match(/^\/polls\/(\d+)\/vote$/);
        if (pollVoteMatch && method === 'POST') {
          if (!currentUsername) return makeResponse({ error: '로그인이 필요합니다.' }, 401);
          return makeResponse(await saveLegacyParticipation(db, 'club_polls', 'poll_' + pollVoteMatch[1], clubId, currentUsername, body?.selected_option ?? body?.selectedOption ?? body?.option));
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
          const {title,location}=body || {};
          const event_date=body?.event_date ?? body?.eventDate;
          const fee_info=body?.fee_info ?? body?.feeInfo;
          if(typeof title!=='string'||!title.trim()) return makeResponse({error:'일정 제목을 입력해주세요.'},400);
          const userSnap = await getDoc(doc(db, 'users', currentUsername || 'member1'));
          const user = userSnap.data() || { name: '총무', id: 1 };

          const times = scheduleTimes({ ...body, event_date });
          if (times.startsAtMs === null || times.endsAtMs === null || times.endsAtMs <= times.startsAtMs) return makeResponse({ error: '일정의 시작·종료 시각을 확인해주세요.' }, 400);
          const newSched = {
            feedSchemaVersion: 1, feedClubId: String(clubId),
            ...times,
            id: Date.now(),
            club_id: clubId,
            title,
            event_date,
            location: location || '미정',
            fee_info: fee_info || '무료',
            attendees: [
              { user_id: user.id, user_name: user.name ?? '회원', user_cell: user.cell_name ?? '', joined_at: new Date().toISOString() }
            ],
            is_pinned: 1,
            creator_name: user.name ?? '회원',
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
          if (!currentUsername) return makeResponse({ error: '로그인이 필요합니다.' }, 401);
          if (typeof body?.attending !== 'boolean') return makeResponse({ error: '참석 상태를 확인해주세요.' }, 400);
          return makeResponse(await saveLegacyParticipation(db, 'club_schedules', 'sched_' + schedAttendMatch[1], clubId, currentUsername, body.attending));
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
          await setLegacyManagers(db,String(clubId),currentUsername || '',[body?.targetUserId],body?.actionType);
          return makeResponse({message:'총무 명단이 업데이트되었습니다.'});
        }

        // POST /api/clubs/:id/handover/propose, /handover/:voteId/agree
        if (subPath === '/handover/propose' && method === 'POST') {
          return makeResponse(await proposeHandover(db,String(clubId),currentUsername || '',body?.targetUserId ?? body?.target_user_id,body?.actionType ?? body?.action_type));
        }
        const handoverAgreeMatch = subPath.match(/^\/handover\/(\d+)\/agree$/);
        if (handoverAgreeMatch && method === 'POST') {
          return makeResponse(await agreeHandover(db,String(clubId),currentUsername || '',handoverAgreeMatch[1]));
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
            db,            Number(cl.id),
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

          await setDoc(doc(db, 'notices', 'current'), newNotice);
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
          if (target.data().name === '둔산제일교회') return makeResponse({ error: '기본 셀은 삭제할 수 없습니다.' }, 400);
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
        if (!cellNames.length || new Set(cellNames).size !== cellNames.length) return makeResponse({error:'빈 목록이나 중복 셀은 저장할 수 없습니다.'},400);
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
          const { name, icon, description } = body || {};
          const manager_ids = [...new Set((body?.manager_ids || []).map(String))] as string[];
          if (manager_ids.length > 3) return makeResponse({error:'총무는 최대 3명입니다.'},400);
          const selectedManagers = await Promise.all(manager_ids.map(id=>getDocs(query(collection(db,'users'),where('id','==',Number(id))))));
          if(selectedManagers.some(s=>s.size!==1 || s.docs[0].data().role==='guest' || s.docs[0].data().is_guest)) return makeResponse({error:'총무 회원 ID를 확인해주세요.'},400);
          const newClub = {
            id: Date.now(),
            name: name || '',
            icon: icon || '⚽',
            description: description || '',
            manager_ids,
            manager_names: selectedManagers.map(s=>s.docs[0].data().name).join(', '),
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
          await setLegacyManagers(db,String(cId),currentUsername || '',body?.manager_ids ?? body?.managerIds);
          return makeResponse({ message: '총무 명단이 업데이트되었습니다.' });
        }
      }

      if (pathname === '/api/head-admin/members') {
        const uSnap = await getDocs(collection(db, 'users'));
        const memberList = uSnap.docs
          .map(d => d.data())
          .filter((u: any) => u.role !== 'guest' && !u.is_guest)
          .map((u: any) => actor?.role === 'media_admin' ? { id: u.id, name: u.name, cell_name: u.cell_name ?? '', role: u.role } : u);
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
          const { id, group_name, target_users } = body || {};
          const tagline = body?.welcome_tagline ?? body?.tagline ?? '';
          const message = body?.welcome_message ?? body?.message ?? '';
          const user_ids = (Array.isArray(body?.user_ids) ? body.user_ids : Array.isArray(body?.userIds) ? body.userIds : []).map(Number).filter(Number.isFinite);
          if (!user_ids.length) return makeResponse({ error: '대상 성도를 1명 이상 선택해주세요.' }, 400);
          if (!String(tagline).trim() && !String(message).trim()) return makeResponse({ error: '환영 문구를 입력해주세요.' }, 400);
          const twId = id || Date.now();
          const newTW = {
            id: twId,
            group_name: group_name || '',
            welcome_tagline: tagline,
            welcome_message: message,
            user_ids,
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
            if(!['appoint','dismiss'].includes(action) || !['member','media_admin'].includes(target.data().role)) return makeResponse({error:'일반 회원 또는 미디어 관리자만 변경할 수 있습니다.'},403);
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
        if (typeof status !== 'string' || !status.trim() || status.length > 20) return makeResponse({ error: '처리 상태를 확인해주세요.' }, 400);
        const report = await getDoc(doc(db, 'reports', `report_${id}`));
        if (!report.exists()) return makeResponse({ error: '제보를 찾을 수 없습니다.' }, 404);
        await updateDoc(report.ref, { status });
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
          if (target.data().role !== 'guest' && !target.data().is_guest) return makeResponse({error:'게스트만 삭제할 수 있습니다.'},403);
          await deleteDoc(target.ref);
          return makeResponse({ message: '게스트 계정이 성공적으로 삭제되었습니다.' });
        }
        return makeResponse({ error: '삭제할 게스트를 찾을 수 없습니다.' }, 404);
      }

      if (pathname === '/api/server-admin/set-role') {
        const { userId, role } = body || {};
        if (method !== 'POST' || !['member','media_admin','head_admin','server_admin'].includes(role)) return makeResponse({error:'올바른 권한을 선택해주세요.'},400);
        const uSnap = await getDocs(collection(db, 'users'));
        const target = uSnap.docs.find(d => d.data().id === userId);
        if (target) {
          if (target.data().role === 'guest' || target.data().is_guest) {
            return makeResponse({ error: '게스트는 권한을 부여받거나 변경할 수 없습니다.' }, 400);
          }
          if (role === 'head_admin' && target.data().cell_name !== '둔산제일교회') {
            return makeResponse({ error: '전체 관리자는 둔산제일교회 소속만 임명할 수 있습니다.' }, 400);
          }
          await updateDoc(target.ref, { role });
          return makeResponse({ message: '권한이 변경되었습니다.' });
        }
        return makeResponse({ error: '사용자를 찾을 수 없습니다.' }, 404);
      }

      if (pathname === '/api/server-admin/reset-security') {
        if (method !== 'POST') return makeResponse({ error: '지원하지 않는 요청입니다.' }, 405);
        const locks = await db.collection('_apiLocks').get();
        await Promise.all(locks.docs.map((d: any) => d.ref.delete()));
        return makeResponse({ message: `2FA 잠금과 실패 횟수를 초기화했습니다. (${locks.size}개 계정)` });
      }

      if (pathname === '/api/server-admin/metrics') {
        const uSnap = await getDocs(collection(db, 'users'));
        const allUsers = uSnap.docs.map(d => d.data());
        const regularMembers = allUsers.filter(u => u.role !== 'guest' && !u.is_guest);
        const guestCount = allUsers.filter(u => u.role === 'guest' || u.is_guest).length;
        const [sessions, posts, locks] = await Promise.all([
          db.collection('_apiSessions').where('expiresAt', '>', new Date()).count().get(),
          db.collection('club_posts').count().get(),
          db.collection('_apiLocks').get(),
        ]);
        const lockList = locks.docs.map((d: any) => d.data());
        return makeResponse({
          traffic: {
            active_sessions: sessions.data().count,
            total_posts: posts.data().count
          },
          total_members: regularMembers.length,
          total_guests: guestCount,
          security: {
            is_locked: lockList.some((l: any) => l.locked),
            fail_count: Math.max(0, ...lockList.map((l: any) => Number(l.failures) || 0)),
            cooldown_until: 0
          }
        });
      }

      // Default 404
      return makeResponse({ error: `Not found: ${pathname}` }, 404);
    } catch (err: any) {
      console.error('Firebase API Error for ' + pathname, err);
      const domainError = typeof err.message === 'string' && /^[가-힣]/.test(err.message);
      return makeResponse({ error: domainError ? err.message : '요청을 처리하지 못했습니다.' }, domainError ? 400 : 500);
    }
}
