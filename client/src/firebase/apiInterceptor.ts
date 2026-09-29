import { syncCachesAfter } from './accountCache';
// 진행 중인 변경 요청 수. 백그라운드 재조회가 누르는 즉시 반영한 화면을 덮어쓰지 않게 한다.
let pendingMutations = 0;
export const hasPendingMutations = () => pendingMutations > 0;
// Keep the existing fetch contract; database access is now server-only.
export function setupApiInterceptor() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
    if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) return originalFetch(input, init);
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, key) => headers.set(key, value));
    if (!headers.has('Authorization')) {
      const token = localStorage.getItem('dfmc_token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }
    const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method === 'GET') return originalFetch(input, { ...init, headers, credentials: 'same-origin' });
    pendingMutations++;
    try {
      const response = await originalFetch(input, { ...init, headers, credentials: 'same-origin' });
      if (response.ok) {
        try {
          const body = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
          const result = await response.clone().json().catch(() => null);
          syncCachesAfter(url.pathname, method, body, result);
        } catch {}
      }
      return response;
    } finally { pendingMutations--; }
  };
}
