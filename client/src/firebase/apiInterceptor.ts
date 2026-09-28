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
    return originalFetch(input, { ...init, headers, credentials: 'same-origin' });
  };
}
