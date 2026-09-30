import request from '../utils/request';
import type { ApiResponse, LoginResult, AdminUser } from '../types/api';

export function login(data: { username: string; password: string }) {
  return request.post<ApiResponse<LoginResult>>('/auth/login', data);
}

export function register(data: { username: string; password: string; nickname?: string }) {
  return request.post<ApiResponse<LoginResult>>('/auth/register', data);
}

export function guestLogin(deviceId?: string) {
  return request.post<ApiResponse<LoginResult>>('/auth/guest', { device_id: deviceId });
}

export function logout() {
  return request.post<ApiResponse<null>>('/admin/logout');
}

export function getProfile() {
  return request.get<ApiResponse<LoginResult['user']>>('/auth/profile');
}

export function updateProfile(data: { nickname?: string; phone?: string; email?: string; password?: string }) {
  return request.patch<ApiResponse<AdminUser>>('/auth/profile', data);
}
