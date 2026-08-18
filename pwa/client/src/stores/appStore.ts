import { create } from 'zustand';
import { api } from '../lib/api';
import type { Activity, UserSettings, AnalyticsData, Task, TimeEntry, TimeBlock } from '../types';

interface AppState {
  activities: Activity[];
  settings: UserSettings | null;
  analytics: AnalyticsData | null;
  tasks: Task[];
  entries: TimeEntry[];
  blocks: TimeBlock[];
  toasts: { id: string; message: string; type: 'success' | 'error' | 'info' }[];
  sidebarOpen: boolean;
  loading: boolean;

  setSidebarOpen: (open: boolean) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  fetchActivities: () => Promise<void>;
  fetchSettings: () => Promise<void>;
  updateSettings: (data: Record<string, unknown>) => Promise<void>;
  fetchAnalytics: (startDate: string, endDate: string, period?: string) => Promise<void>;
  fetchTasks: (date?: string) => Promise<void>;
  fetchEntries: (date?: string) => Promise<void>;
  fetchBlocks: (date: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  activities: [],
  settings: null,
  analytics: null,
  tasks: [],
  entries: [],
  blocks: [],
  toasts: [],
  sidebarOpen: false,
  loading: false,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  addToast: (message, type = 'success') => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), 4000);
  },

  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  fetchActivities: async () => {
    try {
      const activities = await api.activities.list();
      set({ activities });
    } catch { /* offline */ }
  },

  fetchSettings: async () => {
    try {
      const settings = await api.settings.get();
      set({ settings });
      applyTheme(settings.theme);
    } catch { /* offline */ }
  },

  updateSettings: async (data) => {
    const settings = await api.settings.update(data);
    set({ settings });
    if (data.theme) applyTheme(settings.theme);
    get().addToast('Settings saved');
  },

  fetchAnalytics: async (startDate, endDate, period) => {
    set({ loading: true });
    try {
      const analytics = await api.analytics.get(startDate, endDate, period);
      set({ analytics, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  fetchTasks: async (date) => {
    try {
      const tasks = await api.tasks.list(date ? { date } : undefined);
      set({ tasks });
    } catch { /* offline */ }
  },

  fetchEntries: async (date) => {
    try {
      const entries = await api.timeEntries.list(date ? { date } : undefined);
      set({ entries });
    } catch { /* offline */ }
  },

  fetchBlocks: async (date) => {
    try {
      const blocks = await api.timeBlocks.list({ date });
      set({ blocks });
    } catch { /* offline */ }
  },
}));

function applyTheme(theme: string) {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', prefersDark);
  }
}

export { applyTheme };
