const BASE = import.meta.env.VITE_API_URL || '/api';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (res.status === 401) {
    // sem sessão -> manda pro SSO
    window.location.href = BASE + '/auth/login';
    throw new Error('unauthenticated');
  }
  if (!res.ok) throw new Error(`API ${res.status}`);
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  me: () => req<any>('/auth/me'),
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
