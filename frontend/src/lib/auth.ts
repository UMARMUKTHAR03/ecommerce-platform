import { apiGet, apiPost } from './api';

export async function login(email: string, password: string) {
  return apiPost<{ customer: Record<string, unknown> }>('/store/auth/login', {
    email,
    password,
  });
}

export async function logout() {
  return apiPost<{ success: boolean }>('/store/auth/logout', {});
}

export async function register(name: string, email: string, password: string, phone?: string) {
  return apiPost<{ customer: Record<string, unknown> }>('/store/auth/register', {
    name,
    email,
    password,
    phone: phone || undefined,
  });
}

export async function getUser() {
  try {
    const response = await apiGet<Record<string, unknown>>('/store/auth/me');
    return response;
  } catch {
    // If access token has expired or not present, attempt a session refresh using refresh_token cookie
    try {
      const refreshed = await refreshSession();
      if (refreshed?.customer) {
        return refreshed.customer;
      }
      return await apiGet<Record<string, unknown>>('/store/auth/me');
    } catch {
      return null;
    }
  }
}

export async function isAuthenticated() {
  const user = await getUser();
  return Boolean(user);
}

export async function refreshSession() {
  return apiPost<{ customer: Record<string, unknown> }>('/store/auth/refresh', {});
}
