// 角色常量与判定工具（统一数据契约）。
// 全项目所有角色判断必须走这里，禁止再散落 `role === 1` 等字面量。
export const ROLE_USER = 0; // 普通用户
export const ROLE_ADMIN = 1; // 超级管理员
export const ROLE_ORGANIZER = 2; // 主办方

type RoleLike = number | string | undefined | null;

// 兼容后端可能返回的 number / string 角色值，内部统一 Number() 归一。
function normalize(role: RoleLike): number {
  return Number(role);
}

export function isSuperAdmin(role: RoleLike): boolean {
  return normalize(role) === ROLE_ADMIN;
}

export function isOrganizer(role: RoleLike): boolean {
  return normalize(role) === ROLE_ORGANIZER;
}

// 是否可进入管理后台（超级管理员或主办方）。
export function canAccessAdmin(role: RoleLike): boolean {
  const value = normalize(role);
  return value === ROLE_ADMIN || value === ROLE_ORGANIZER;
}
