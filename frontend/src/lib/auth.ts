import { apiGet, apiPost } from './api';

interface AuthResponse {
  customer: Record<string, unknown>;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
}

const TOKEN_KEY = 'bf_access_token';
const REFRESH_TOKEN_KEY = 'bf_refresh_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setStoredTokens(accessToken: string | null, refreshToken?: string | null) {
  if (typeof window === 'undefined') return;
  if (accessToken) {
    localStorage.setItem(TOKEN_KEY, accessToken);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
  if (refreshToken !== undefined) {
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }
}

export function setStoredToken(token: string | null) {
  setStoredTokens(token);
}

export async function login(email: string, password: string) {
  const res = await apiPost<AuthResponse>('/store/auth/login', {
    email,
    password,
  });
  if (res.tokens?.accessToken) {
    setStoredTokens(res.tokens.accessToken, res.tokens.refreshToken);
  }
  return res;
}

export async function logout() {
  const currentRefreshToken = getStoredRefreshToken();
  setStoredTokens(null, null);
  return apiPost<{ success: boolean }>('/store/auth/logout', {
    refreshToken: currentRefreshToken || undefined,
  });
}

export async function register(name: string, email: string, password: string, phone?: string) {
  const res = await apiPost<AuthResponse>('/store/auth/register', {
    name,
    email,
    password,
    phone: phone || undefined,
  });
  if (res.tokens?.accessToken) {
    setStoredTokens(res.tokens.accessToken, res.tokens.refreshToken);
  }
  return res;
}

export async function getUser() {
  const currentToken = getStoredToken();
  const currentRefreshToken = getStoredRefreshToken();

  // If customer has no stored token or refresh token, they are simply not logged in
  if (!currentToken && !currentRefreshToken) {
    return null;
  }

  try {
    const response = await apiGet<Record<string, unknown>>('/store/auth/me');
    return response;
  } catch {
    // If access token has expired or invalid, attempt session refresh only if refresh token exists
    if (!currentRefreshToken) {
      setStoredTokens(null, null);
      return null;
    }
    try {
      const refreshed = await refreshSession();
      if (refreshed?.tokens?.accessToken) {
        setStoredTokens(refreshed.tokens.accessToken, refreshed.tokens.refreshToken);
      }
      if (refreshed?.customer) {
        return refreshed.customer;
      }
      return await apiGet<Record<string, unknown>>('/store/auth/me');
    } catch {
      setStoredTokens(null, null);
      return null;
    }
  }
}

export async function isAuthenticated() {
  const user = await getUser();
  return Boolean(user);
}

export async function refreshSession() {
  const storedRefreshToken = getStoredRefreshToken();
  return apiPost<AuthResponse>('/store/auth/refresh', {
    refreshToken: storedRefreshToken || undefined,
  });
}
