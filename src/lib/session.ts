/**
 * Client-side session and cache management
 * Synchronizes authentication across localStorage, sessionStorage, and browser cookies.
 * Ensures persistent logins that survive tab switches, page reloads, and browser restarts.
 * Cleans up all storage completely on logout.
 */

export function saveSession(accessToken: string, user?: any, tenant?: any) {
  if (typeof window === 'undefined') return;

  try {
    // 1. Persist in localStorage
    localStorage.setItem('accessToken', accessToken);
    if (user) localStorage.setItem('user', JSON.stringify(user));
    if (tenant) localStorage.setItem('tenant', JSON.stringify(tenant));

    // 2. Persist in sessionStorage (for tab session isolation & backup)
    sessionStorage.setItem('accessToken', accessToken);
    if (user) sessionStorage.setItem('user', JSON.stringify(user));
    if (tenant) sessionStorage.setItem('tenant', JSON.stringify(tenant));

    // 3. Set persistent browser cookies (30 days)
    const maxAge = 30 * 24 * 60 * 60; // 30 days
    const isSecure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `accessToken=${encodeURIComponent(accessToken)}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure}`;
    document.cookie = `token=${encodeURIComponent(accessToken)}; path=/; max-age=${maxAge}; SameSite=Lax${isSecure}`;
  } catch (err) {
    console.warn('Could not save session to storage/cookies:', err);
  }
}

export function getSessionToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Check localStorage
    const localToken = localStorage.getItem('accessToken');
    if (localToken && localToken.trim() !== '') {
      return localToken;
    }

    // 2. Check sessionStorage
    const sessionToken = sessionStorage.getItem('accessToken');
    if (sessionToken && sessionToken.trim() !== '') {
      // Sync back to localStorage
      localStorage.setItem('accessToken', sessionToken);
      return sessionToken;
    }

    // 3. Check browser cookies
    const match = document.cookie.match(/(?:^|;\s*)(?:accessToken|token)=([^;]+)/);
    if (match && match[1]) {
      const cookieToken = decodeURIComponent(match[1]);
      if (cookieToken.trim() !== '') {
        // Sync to localStorage & sessionStorage
        localStorage.setItem('accessToken', cookieToken);
        sessionStorage.setItem('accessToken', cookieToken);
        return cookieToken;
      }
    }
  } catch (err) {
    console.warn('Could not read session token:', err);
  }

  return null;
}

export function getSessionData(): { user: any | null; tenant: any | null; token: string | null } {
  const token = getSessionToken();
  let user: any = null;
  let tenant: any = null;

  if (typeof window !== 'undefined') {
    try {
      const uStr = localStorage.getItem('user') || sessionStorage.getItem('user');
      const tStr = localStorage.getItem('tenant') || sessionStorage.getItem('tenant');
      if (uStr) user = JSON.parse(uStr);
      if (tStr) tenant = JSON.parse(tStr);
    } catch (e) {}
  }

  return { token, user, tenant };
}

export function clearSession() {
  if (typeof window === 'undefined') return;

  try {
    // 1. Clear localStorage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    localStorage.removeItem('sidebar_collapsed');

    // 2. Clear sessionStorage
    sessionStorage.clear();

    // 3. Expire all auth cookies
    document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    document.cookie = 'refresh_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  } catch (err) {
    console.warn('Could not clear session storage/cookies:', err);
  }
}

let activeRefreshPromise: Promise<string | null> | null = null;

/**
 * Rotates the refresh token and persists the newly issued access token.
 * Uses promise deduplication so multiple simultaneous 401 calls only trigger one refresh request.
 */
export async function refreshTokenAndResume(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      if (data.success && data.accessToken) {
        saveSession(data.accessToken, data.user, data.tenant);
        return data.accessToken as string;
      }
      return null;
    } catch (err) {
      console.warn('Silent session refresh failed:', err);
      return null;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

/**
 * Handles terminal session expiration (refresh token expired/invalid).
 * Clears storage and redirects cleanly to login.
 */
export function handleSessionExpired() {
  if (typeof window === 'undefined') return;
  clearSession();
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login?expired=true';
  }
}

/**
 * Universal authenticated fetch with automatic silent refresh on 401.
 * If refresh succeeds, automatically retries the request with the new access token.
 * If refresh fails, logs out the user cleanly.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const token = getSessionToken();
  const options: RequestInit = init ? { ...init } : {};
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  options.headers = headers;

  let response = await fetch(input, options);

  // If 401 Unauthorized, attempt silent refresh using refresh token
  if (response.status === 401) {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    if (
      !urlStr.includes('/api/auth/refresh') &&
      !urlStr.includes('/api/auth/login') &&
      !urlStr.includes('/api/auth/logout')
    ) {
      const newToken = await refreshTokenAndResume();
      if (newToken) {
        // Retry the original request with the fresh token
        const retryHeaders = new Headers(options.headers);
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
        options.headers = retryHeaders;
        response = await fetch(input, options);
      } else {
        // Refresh token itself expired or revoked -> Auto logout
        handleSessionExpired();
      }
    }
  }

  return response;
}

/**
 * Installs global client-side fetch interceptor.
 * Guarantees that EVERY fetch call (Redux thunk, custom hook, component fetch)
 * gets silent token refresh on 401 and auto-logout on expired session.
 */
export function setupFetchAuthInterceptor() {
  if (typeof window === 'undefined') return;
  if ((window as any).__fetchAuthIntercepted) return;
  (window as any).__fetchAuthIntercepted = true;

  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

    const isLocalApi =
      urlStr.startsWith('/api/') ||
      (typeof window !== 'undefined' && urlStr.includes(window.location.origin + '/api/'));

    const isAuthRoute =
      urlStr.includes('/api/auth/refresh') ||
      urlStr.includes('/api/auth/login') ||
      urlStr.includes('/api/auth/logout');

    if (!isLocalApi || isAuthRoute) {
      return originalFetch.call(this, input, init);
    }

    // Attach Authorization header if missing and token exists
    const token = getSessionToken();
    const options: RequestInit = init ? { ...init } : {};
    const headers = new Headers(options.headers || {});

    if (token && (!headers.has('Authorization') || headers.get('Authorization') === 'Bearer null')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    options.headers = headers;

    let response = await originalFetch.call(this, input, options);

    if (response.status === 401) {
      const newToken = await refreshTokenAndResume();
      if (newToken) {
        // Retry with fresh token
        const retryHeaders = new Headers(options.headers);
        retryHeaders.set('Authorization', `Bearer ${newToken}`);
        options.headers = retryHeaders;
        response = await originalFetch.call(this, input, options);
      } else {
        // Expired -> clean logout
        handleSessionExpired();
      }
    }

    return response;
  };
}
