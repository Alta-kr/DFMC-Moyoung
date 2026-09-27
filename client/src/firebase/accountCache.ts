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
