import { HttpException, HttpStatus } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { UserRole } from '../../modules/users/entities/user.entity';

/**
 * 集中式「主办方数据范围」纯函数工具（无 DI）。
 *
 * 归属唯一真源为 sessions.organizer_id：投稿 / 报名均经既有 session 关联派生归属。
 * - role=1（超管）：不加任何过滤，可访问全部数据。
 * - role=2（主办方）：仅能访问 sessions.organizer_id = 当前用户 id 的场次及其派生数据。
 *
 * 命名参数统一使用 organizerScopeId，避免与既有 :sessionId / :status 等冲突。
 */

/** 数据范围判定所需的最小用户上下文（来自 jwt.strategy.validate 返回体）。 */
export interface ScopeUser {
  id: number;
  role: number;
}

/** 归属校验所需的最小场次结构。 */
interface ScopeSession {
  organizer_id?: number | null;
}

/** 归属校验所需的最小报名 / 投稿结构（需已加载 session 关联）。 */
interface ScopeRegistration {
  session?: ScopeSession | null;
}

/** 是否超级管理员（role=1）。 */
export function isSuperAdmin(user?: ScopeUser | null): boolean {
  return user?.role === UserRole.ADMIN;
}

/** 是否主办方（role=2）。 */
export function isOrganizer(user?: ScopeUser | null): boolean {
  return user?.role === UserRole.ORGANIZER;
}

/**
 * 对已 join 了 session 别名的 QueryBuilder 追加主办方数据范围过滤。
 * 超管不加任何条件；主办方追加 `<alias>.organizer_id = :organizerScopeId`。
 */
export function applySessionScope<T>(
  qb: SelectQueryBuilder<T>,
  user: ScopeUser,
  alias = 'session',
): SelectQueryBuilder<T> {
  if (isOrganizer(user)) {
    qb.andWhere(`${alias}.organizer_id = :organizerScopeId`, { organizerScopeId: user.id });
  }
  return qb;
}

/**
 * 单场次归属断言：主办方访问非自身场次 → 404「场次不存在」，
 * 与既有「不存在」语义一致，不泄露资源是否存在。
 * fail closed：session 为空同样抛 404（调用方已自行 404 时行为不变，仅纵深防御）。
 */
export function assertSessionOwned(
  session: ScopeSession | null | undefined,
  user: ScopeUser,
): void {
  if (!session) throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);
  if (isOrganizer(user) && session.organizer_id !== user.id) {
    throw new HttpException('场次不存在', HttpStatus.NOT_FOUND);
  }
}

/**
 * 批量归属断言（fail closed）：主办方传入的集合中若含任一非自身场次的数据
 * → 403「无权操作其他主办方的数据」，不做静默过滤。
 * 传入项必须已加载 session 关联，否则视为不可校验并拒绝。
 */
export function assertRegistrationsOwned(
  registrations: ScopeRegistration[] | null | undefined,
  user: ScopeUser,
): void {
  if (!isOrganizer(user)) return;
  const list = registrations || [];
  const violated = list.some((reg) => reg?.session?.organizer_id !== user.id);
  if (violated) {
    throw new HttpException('无权操作其他主办方的数据', HttpStatus.FORBIDDEN);
  }
}
