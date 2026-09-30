export interface User {
  id: number;
  username: string;
  nickname: string;
  phone: string | null;
  email: string | null;
  // 角色：0=普通用户 USER，1=超级管理员 ADMIN，2=主办方 ORGANIZER
  role: number;
  avatar_url: string | null;
  // 账号状态：1=启用，0=停用
  status?: number;
  // 对外展示的主办方名称；非空即进入公共主办方列表
  organizer_name?: string | null;
  created_at: string;
  updated_at: string;
}
