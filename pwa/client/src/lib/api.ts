const API_BASE = '/api';

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data.error || 'Request failed');
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw new ApiError(0, 'Network error — working offline');
  }
}

export const api = {
  auth: {
    register: (body: { username: string; email: string; password: string; confirmPassword: string }) =>
      request<{ token: string; user: import('./types').User }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: { identifier: string; password: string; remember?: boolean }) =>
      request<{ token: string; user: import('./types').User }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    me: () => request<{ user: import('./types').User }>('/auth/me'),
    changePassword: (body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
      request('/auth/password', { method: 'PUT', body: JSON.stringify(body) }),
    deleteAccount: (password: string) =>
      request('/auth/account', { method: 'DELETE', body: JSON.stringify({ password }) }),
  },
  activities: {
    list: () => request<import('./types').Activity[]>('/activities'),
    create: (body: Partial<import('./types').Activity>) =>
      request<import('./types').Activity>('/activities', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Partial<import('./types').Activity>) =>
      request<import('./types').Activity>(`/activities/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => request(`/activities/${id}`, { method: 'DELETE' }),
  },
  timeEntries: {
    list: (params?: { date?: string; startDate?: string; endDate?: string }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return request<import('./types').TimeEntry[]>(`/time-entries${q ? `?${q}` : ''}`);
    },
    create: (body: Record<string, unknown>) =>
      request<import('./types').TimeEntry>('/time-entries', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Record<string, unknown>) =>
      request<import('./types').TimeEntry>(`/time-entries/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => request(`/time-entries/${id}`, { method: 'DELETE' }),
  },
  timeBlocks: {
    list: (params: { date?: string; startDate?: string; endDate?: string }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return request<import('./types').TimeBlock[]>(`/time-blocks?${q}`);
    },
    update: (date: string, blocks: { blockIndex: number; activityId: string | null }[]) =>
      request<import('./types').TimeBlock[]>('/time-blocks', { method: 'PUT', body: JSON.stringify({ date, blocks }) }),
  },
  timer: {
    get: () => request<import('./types').ActiveTimer | null>('/timer'),
    start: (activityId: string, notes?: string) =>
      request<import('./types').ActiveTimer>('/timer/start', { method: 'POST', body: JSON.stringify({ activityId, notes }) }),
    pause: () => request<import('./types').ActiveTimer>('/timer/pause', { method: 'POST' }),
    resume: () => request<import('./types').ActiveTimer>('/timer/resume', { method: 'POST' }),
    stop: () => request<import('./types').TimeEntry>('/timer/stop', { method: 'POST' }),
  },
  tasks: {
    list: (params?: { date?: string; startDate?: string; endDate?: string }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return request<import('./types').Task[]>(`/tasks${q ? `?${q}` : ''}`);
    },
    create: (body: Record<string, unknown>) =>
      request<import('./types').Task>('/tasks', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: Record<string, unknown>) =>
      request<import('./types').Task>(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete: (id: string) => request(`/tasks/${id}`, { method: 'DELETE' }),
  },
  settings: {
    get: () => request<import('./types').UserSettings>('/settings'),
    update: (body: Record<string, unknown>) =>
      request<import('./types').UserSettings>('/settings', { method: 'PUT', body: JSON.stringify(body) }),
  },
  analytics: {
    get: (startDate: string, endDate: string, period?: string) =>
      request<import('./types').AnalyticsData>(`/analytics?startDate=${startDate}&endDate=${endDate}&period=${period || 'custom'}`),
  },
  data: {
    export: () => request<Record<string, unknown>>('/export'),
    import: (data: Record<string, unknown>) =>
      request('/import', { method: 'POST', body: JSON.stringify({ data }) }),
    clear: () => request('/clear-data', { method: 'DELETE' }),
  },
};

export { ApiError };
