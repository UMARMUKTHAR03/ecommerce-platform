import { apiGet, apiPost } from './api';

interface AuthResponse {
  customer: Record<string, unknown>;
  tokens?: {
    accessToken: string;
    refreshToken: string;
  };
}

const TOKEN_KEY = 'bf_access_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export async function login(email: string, password: string) {
  const res = await apiPost<AuthResponse>('/store/auth/login', {
    email,
    password,
  });
  if (res.tokens?.accessToken) {
    setStoredToken(res.tokens.accessToken);
  }
  return res;
}

export async function logout() {
  setStoredToken(null);
  return apiPost<{ success: boolean }>('/store/auth/logout', {});
}

export async function register(name: string, email: string, password: string, phone?: string) {
  const res = await apiPost<AuthResponse>('/store/auth/register', {
    name,
    email,
    password,
    phone: phone || undefined,
  });
  if (res.tokens?.accessToken) {
    setStoredToken(res.tokens.accessToken);
  }
  return res;
}

export async function getUser() {
  try {
    const response = await apiGet<Record<string, unknown>>('/store/auth/me');
    return response;
  } catch {
    // If access token has expired or not present, attempt a session refresh using refresh_token cookie
    try {
      const refreshed = await refreshSession();
      if (refreshed?.tokens?.accessToken) {
        setStoredToken(refreshed.tokens.accessToken);
      }
      if (refreshed?.customer) {
        return refreshed.customer;
      }
      return await apiGet<Record<string, unknown>>('/store/auth/me');
    } catch {
      setStoredToken(null);
      return null;
    }
  }
}

export async function isAuthenticated() {
  const user = await getUser();
  return Boolean(user);
}

export async function refreshSession() {
  return apiPost<AuthResponse>('/store/auth/refresh', {});
}
