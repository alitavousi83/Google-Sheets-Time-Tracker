import { create } from 'zustand';
import { api, ApiError } from '../lib/api';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  init: () => Promise<void>;
  login: (identifier: string, password: string, remember?: boolean) => Promise<void>;
  register: (data: { username: string; email: string; password: string; confirmPassword: string }) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: true,
  error: null,

  init: async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      set({ loading: false, user: null, token: null });
      return;
    }
    try {
      const { user } = await api.auth.me();
      set({ user, token, loading: false, error: null });
    } catch {
      localStorage.removeItem('token');
      set({ user: null, token: null, loading: false });
    }
  },

  login: async (identifier, password, remember) => {
    set({ loading: true, error: null });
    try {
      const { token, user } = await api.auth.login({ identifier, password, remember });
      localStorage.setItem('token', token);
      set({ user, token, loading: false, error: null });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Login failed';
      set({ loading: false, error: msg });
      throw err;
    }
  },

  register: async (data) => {
    set({ loading: true, error: null });
    try {
      const { token, user } = await api.auth.register(data);
      localStorage.setItem('token', token);
      set({ user, token, loading: false, error: null });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Registration failed';
      set({ loading: false, error: msg });
      throw err;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null, error: null });
  },

  clearError: () => set({ error: null }),
}));
