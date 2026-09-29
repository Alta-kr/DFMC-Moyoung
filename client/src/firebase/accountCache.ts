const isCache = (key: string) => key.startsWith('dfmc_') && key.includes('cache');
function scoped(key: string) {
  if (!isCache(key)) return key;
  let account = 'anonymous';
  try { account = JSON.parse(localStorage.getItem('dfmc_user') || 'null')?.username || account; } catch {}
  return 'moyoung_cache_v2:' + encodeURIComponent(account) + ':' + key;
}
export const accountCache = {
  getItem: (key: string) => localStorage.getItem(scoped(key)),
  setItem: (key: string, value: string) => localStorage.setItem(scoped(key), value),
  removeItem: (key: string) => localStorage.removeItem(scoped(key)),
};
export function clearAccountCaches() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith('moyoung_cache_v2:') || isCache(key)) localStorage.removeItem(key);
  }
}

export function cacheForAccount(account: string) {
  const keyFor=(key:string)=>isCache(key)?'moyoung_cache_v2:'+encodeURIComponent(account)+':'+key:key;
  return {
    getItem:(key:string)=>localStorage.getItem(keyFor(key)),
    setItem:(key:string,value:string)=>localStorage.setItem(keyFor(key),value),
    removeItem:(key:string)=>localStorage.removeItem(keyFor(key)),
  };
}

// 변경이 성공하면 같은 변경을 다른 화면(홈·모영 피드)의 저장본에도 바로 적용한다.
// 화면을 옮겨도 로딩 없이 맞는 내용이 보이고, 이후 백그라운드 재조회로 서버와 맞춘다.
function eachCache(marker: string, update: (value: any) => any) {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith('moyoung_cache_v2:') || !key.endsWith(':' + marker)) continue;
    try {
      const next = update(JSON.parse(localStorage.getItem(key) || 'null'));
      if (next === null) localStorage.removeItem(key); else if (next) localStorage.setItem(key, JSON.stringify(next));
    } catch { localStorage.removeItem(key); }
  }
}
const mapLobbySchedules = (data: any, fn: (list: any[]) => any[]) => data && ({ ...data,
  schedules: fn(data.schedules || []), highlightedSchedules: fn(data.highlightedSchedules || data.schedules || []) });
const timeOf = (s: any) => Number(s?.startsAtMs ?? s?.timestamp ?? NaN);

export function syncCachesAfter(pathname: string, method: string, body: any, result: any) {
  const club = pathname.match(/^\/api\/clubs\/(\d+)(\/.*)?$/);
  const clubId = club?.[1], rest = club?.[2] || '';
  if (club && rest === '/visit') return;
  const attend = rest.match(/^\/schedules\/(\d+)\/attend$/);
  const schedule = rest.match(/^\/schedules\/(\d+)$/);
  if (attend) {
    const id = Number(attend[1]);
    const attending = typeof result?.is_attending === 'boolean' ? result.is_attending : Boolean(body?.attending);
    const attendees = Array.isArray(result?.attendees) ? result.attendees : null;
    eachCache('dfmc_lobby_cache', data => mapLobbySchedules(data, list => list.map(s => Number(s.id) !== id ? s : {
      ...s, is_attending: attending, attendees_count: attendees ? attendees.length : s.attendees_count })));
    eachCache('dfmc_club_cache_' + clubId, data => data && ({ ...data, schedules: (data.schedules || []).map((s: any) => Number(s.id) !== id ? s : {
      ...s, is_attending: attending, ...(attendees ? { attendees } : {}) }) }));
    return;
  }
  if (schedule && method === 'DELETE') {
    const id = Number(schedule[1]);
    eachCache('dfmc_lobby_cache', data => mapLobbySchedules(data, list => list.filter(s => Number(s.id) !== id)));
    eachCache('dfmc_club_cache_' + clubId, data => data && ({ ...data, schedules: (data.schedules || []).filter((s: any) => Number(s.id) !== id) }));
    return;
  }
  if (rest === '/schedules' && method === 'POST' && result?.schedule) {
    const created = result.schedule;
    eachCache('dfmc_club_cache_' + clubId, data => data && ({ ...data,
      schedules: (data.schedules || []).some((s: any) => s.id === created.id) ? data.schedules : [...(data.schedules || []), created] }));
    // 홈은 모영당 가장 임박한 일정 1개만 보여 준다.
    eachCache('dfmc_lobby_cache', data => {
      if (!data || !(timeOf(created) > Date.now())) return data;
      const info = (data.clubs || []).find((c: any) => String(c.id) === String(clubId)) || {};
      const current = (data.schedules || []).find((s: any) => String(s.club_id) === String(clubId));
      if (current && timeOf(current) <= timeOf(created)) return data;
      const item = { id: created.id, club_id: Number(clubId), club_name: info.name ?? '', club_icon: info.icon || '✨', title: created.title,
        event_date: created.event_date, location: created.location || '', fee_info: created.fee_info || '', attendees_count: 0,
        max_attendees: created.max_attendees, total_members: info.member_count, is_attending: false, timestamp: timeOf(created) };
      return mapLobbySchedules(data, list => [...list.filter(s => String(s.club_id) !== String(clubId)), item].sort((a, b) => timeOf(a) - timeOf(b)));
    });
    return;
  }
  // 드문 관리 변경은 저장본을 비우고 다음에 새로 받는다.
  const admin = /^\/api\/(head-admin|server-admin)\//.test(pathname);
  if ((club && /^(|\/info|\/handover.*|\/members.*)$/.test(rest)) || admin || pathname === '/api/lobby/update-cell') {
    eachCache('dfmc_lobby_cache', () => null);
  }
  if (admin) {
    for (const key of Object.keys(localStorage)) if (key.startsWith('moyoung_cache_v2:') && key.includes(':dfmc_club_cache_')) localStorage.removeItem(key);
  }
}
