import { create } from 'zustand';
import type { AdminUser } from '../types/api';
import {
  login as loginApi,
  register as registerApi,
  guestLogin as guestLoginApi,
  logout as logoutApi,
  getProfile,
} from '../services/auth';

function getDeviceId(): string {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = 'dev_' + (crypto.randomUUID?.() || Date.now().toString(36));
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  loading: boolean;
  authReady: boolean;
  isGuest: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, nickname?: string) => Promise<void>;
  guestLogin: () => Promise<boolean>;
  logout: () => void;
  fetchProfile: () => Promise<void>;
  isAuthenticated: () => boolean;
  ensureAuth: () => boolean;
  setAuthReady: (ready: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('admin_token'),
  loading: false,
  authReady: false,
  isGuest: localStorage.getItem('is_guest') === 'true',

  login: async (username, password) => {
    set({ loading: true });
    try {
      const res = await loginApi({ username, password });
      const { token, user } = res.data;
      localStorage.setItem('admin_token', token);
      localStorage.removeItem('is_guest');
      set({ user, token, loading: false, authReady: true, isGuest: false });
    } catch (error) {
      set({ loading: false });
      // 优先透出后端原始文案（如「账号已停用，请联系管理员」）；request.ts 拦截器已将其包成 Error。
      throw error instanceof Error && error.message ? error : new Error('登录失败');
    }
  },

  register: async (username, password, nickname) => {
    set({ loading: true });
    try {
      const res = await registerApi({ username, password, nickname });
      const { token, user } = res.data;
      localStorage.setItem('admin_token', token);
      localStorage.removeItem('is_guest');
      set({ user, token, loading: false, authReady: true, isGuest: false });
    } catch (error: unknown) {
      set({ loading: false });
      const message = error instanceof Error ? error.message : '注册失败';
      throw new Error(message, { cause: error });
    }
  },

  guestLogin: async () => {
    try {
      const deviceId = getDeviceId();
      const res = await guestLoginApi(deviceId);
      const { token, user } = res.data;
      localStorage.setItem('admin_token', token);
      localStorage.setItem('is_guest', 'true');
      set({ token, user, authReady: true, isGuest: true });
      return true;
    } catch {
      set({ authReady: true });
      return false;
    }
  },

  logout: () => {
    logoutApi().catch(() => {});
    localStorage.removeItem('admin_token');
    localStorage.removeItem('is_guest');
    set({ user: null, token: null, isGuest: false });
    window.location.href = '/login';
  },

  fetchProfile: async () => {
    try {
      const res = await getProfile();
      set({ user: res.data, authReady: true });
    } catch {
      set({ authReady: true });
    }
  },

  isAuthenticated: () => {
    const { token, user } = get();
    return !!token && !!user;
  },

  ensureAuth: () => {
    const { token } = get();
    if (token) return true;
    const currentPath = window.location.pathname + window.location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
    return false;
  },

  setAuthReady: (ready) => set({ authReady: ready }),
}));
