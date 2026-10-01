export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  page_size: number;
}

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';
export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: AdminUser;
  guest_id?: number;
  guest_secret?: string;
}

export interface AdminUser {
  id: number;
  username: string;
  nickname: string;
  // 角色：0=普通用户，1=超级管理员，2=主办方
  role: string | number;
  avatar_url?: string;
  phone?: string;
  email?: string;
  // 账号状态：1=启用，0=停用
  status?: number;
  // 对外展示的主办方名称；非空即进入公共主办方列表
  organizer_name?: string | null;
  created_at?: string;
  updated_at?: string;
}
