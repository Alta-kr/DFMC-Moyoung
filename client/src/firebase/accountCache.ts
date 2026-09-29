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

// 변경이 성공하면 그 변경을 보여 주는 다른 화면의 저장본을 비워 다음에 들어갈 때 옛 내용이 보이지 않게 한다.
export function invalidateCachesAfter(pathname: string) {
  const club = pathname.match(/^\/api\/clubs\/(\d+)(\/.*)?$/);
  const rest = club?.[2] || '';
  if (club && rest === '/visit') return;
  const removeAll = (marker: string) => {
    for (const key of Object.keys(localStorage)) if (key.startsWith('moyoung_cache_v2:') && key.includes(marker)) localStorage.removeItem(key);
  };
  // 홈: 일정·모영 정보·총무·회원 변경, 관리 화면 변경, 소속 셀 변경
  if ((club && /^(|\/info|\/handover.*|\/members.*|\/schedules.*)$/.test(rest)) || /^\/api\/(head-admin|server-admin)\//.test(pathname) || pathname === '/api/lobby/update-cell') {
    removeAll(':dfmc_lobby_cache');
  }
  // 모영 피드: 홈에서 한 참석, 관리 화면에서 바꾼 모영 정보
  if (club && /^\/schedules\/\d+\/attend$/.test(rest)) removeAll(':dfmc_club_cache_' + club[1]);
  if (/^\/api\/(head-admin|server-admin)\//.test(pathname)) removeAll(':dfmc_club_cache_');
}
