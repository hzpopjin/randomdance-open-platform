import request from '../utils/request';
import type { ApiResponse, PaginatedData } from '../types/api';
import type { User } from '../types/user';

export function getUsers(params?: { page?: number; page_size?: number; keyword?: string; role?: number }) {
  return request.get<ApiResponse<PaginatedData<User>>>('/admin/users', { params });
}

export function getUserDetail(id: number) {
  return request.get<ApiResponse<User>>(`/admin/users/${id}`);
}

// 创建用户。role=2 时 organizer_name 必填，否则后端返回 400。
export function createUser(data: {
  username: string;
  password: string;
  nickname?: string;
  phone?: string;
  email?: string;
  role?: number;
  organizer_name?: string;
}) {
  return request.post<ApiResponse<User>>('/admin/users', data);
}

// 编辑用户（不含角色与状态）。
export function updateUser(id: number, data: {
  nickname?: string;
  phone?: string;
  email?: string;
  organizer_name?: string;
}) {
  return request.put<ApiResponse<User>>(`/admin/users/${id}`, data);
}

// 变更角色；升为主办方（role=2）时可携带 organizer_name。
export function updateUserRole(id: number, role: number, organizer_name?: string) {
  return request.put<ApiResponse<{ id: number; role: number; organizer_name: string | null }>>(
    `/admin/users/${id}/role`,
    { role, ...(organizer_name !== undefined ? { organizer_name } : {}) },
  );
}

// 启用/停用账号。status: 1=启用，0=停用。
export function updateUserStatus(id: number, status: number) {
  return request.put<ApiResponse<{ id: number; status: number }>>(
    `/admin/users/${id}/status`,
    { status },
  );
}
