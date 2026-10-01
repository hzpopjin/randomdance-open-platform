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

const GUEST_CREDENTIAL_KEY = 'guest_credential_v2';
let authGeneration = 0;
let pendingGuest: Promise<boolean> | undefined;

function getGuestCredential(): { guest_id: number; guest_secret: string } | undefined {
  try {
    const value = localStorage.getItem(GUEST_CREDENTIAL_KEY);
    if (!value) return undefined;
    const parsed = JSON.parse(value);
    if (Number.isSafeInteger(parsed.guest_id) && typeof parsed.guest_secret === 'string') return parsed;
  } catch { /* Invalid local data is not an identity proof. */ }
  return undefined;
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
    ++authGeneration;
    pendingGuest = undefined;
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
    ++authGeneration;
    pendingGuest = undefined;
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

  guestLogin: () => {
    // StrictMode and concurrent route effects must share one first-visit identity.
    if (pendingGuest) return pendingGuest;
    const generation = authGeneration;
    const request = (async () => {
      try {
        const deviceId = getDeviceId();
        const res = await guestLoginApi(deviceId, getGuestCredential());
        if (generation !== authGeneration) return false;
        const { token, user, guest_id, guest_secret } = res.data;
        if (!guest_id || !guest_secret) throw new Error('服务端未返回游客凭证');
        localStorage.setItem(GUEST_CREDENTIAL_KEY, JSON.stringify({ guest_id, guest_secret }));
        localStorage.setItem('admin_token', token);
        localStorage.setItem('is_guest', 'true');
        set({ token, user, authReady: true, isGuest: true });
        return true;
      } catch {
        if (generation === authGeneration) set({ authReady: true });
        return false;
      }
    })();
    pendingGuest = request;
    void request.finally(() => {
      if (pendingGuest === request) pendingGuest = undefined;
    });
    return request;
  },

  logout: () => {
    ++authGeneration;
    pendingGuest = undefined;
    logoutApi().catch(() => {});
    localStorage.removeItem('admin_token');
    localStorage.removeItem('is_guest');
    // Explicit logout forgets the bearer proof on this device.
    localStorage.removeItem(GUEST_CREDENTIAL_KEY);
    set({ user: null, token: null, isGuest: false });
    window.location.href = '/login';
  },

  fetchProfile: async () => {
    const generation = authGeneration;
    const token = get().token;
    try {
      const res = await getProfile();
      if (generation !== authGeneration || token !== get().token) return;
      set({ user: res.data, authReady: true });
    } catch {
      if (generation !== authGeneration || token !== get().token) return;
      localStorage.removeItem('admin_token');
      set({ token: null, user: null, authReady: true });
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
