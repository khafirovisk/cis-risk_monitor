const BASE = import.meta.env.VITE_API_URL || '/api';

export const SAML_LOGIN_URL = BASE + '/auth/login';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`API ${res.status}`), { status: res.status, body });
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  me: () => req<any>('/auth/me'),
  localLogin: (username: string, password: string) =>
    req<any>('/auth/local/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    req<any>('/auth/local/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
  logout: () => req<any>('/auth/logout', { method: 'POST' }),
  getSamlConfig: () => req<any>('/auth/saml/config'),
  updateSamlConfig: (b: any) => req<any>('/auth/saml/config', { method: 'PUT', body: JSON.stringify(b) }),
  controls: () => req<any[]>('/controls'),
  control: (n: number) => req<any>(`/controls/${n}`),
  assessments: () => req<any[]>('/assessments'),
  createAssessment: (b: any) => req<any>('/assessments', { method: 'POST', body: JSON.stringify(b) }),
  assessment: (id: string) => req<any>(`/assessments/${id}`),
  summary: (id: string) => req<any>(`/assessments/${id}/summary`),
  setItem: (id: string, sg: string, b: any) =>
    req<any>(`/assessments/${id}/items/${sg}`, { method: 'PUT', body: JSON.stringify(b) }),
  risks: () => req<any[]>('/risks'),
  createRisk: (b: any) => req<any>('/risks', { method: 'POST', body: JSON.stringify(b) }),
  updateRisk: (id: string, b: any) => req<any>(`/risks/${id}`, { method: 'PUT', body: JSON.stringify(b) }),
  deleteRisk: (id: string) => req<void>(`/risks/${id}`, { method: 'DELETE' }),
};
