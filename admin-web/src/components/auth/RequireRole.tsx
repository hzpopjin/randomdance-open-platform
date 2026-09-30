import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin, message } from 'antd';
import { useAuthStore } from '../../stores/authStore';
import { canAccessAdmin } from '../../utils/role';

interface RequireRoleProps {
  // 允许访问的角色集合（契约角色值：0/1/2）。
  roles: number[];
  children: React.ReactNode;
}

// 平台级路由守卫：仅允许指定角色访问。后端 @Roles 为唯一权威防线，此处做体验层兜底。
export default function RequireRole({ roles, children }: RequireRoleProps) {
  const { user, token, authReady } = useAuthStore();
  const location = useLocation();
  const role = user?.role;
  const allowed = !!user && roles.some((r) => Number(role) === r);

  // 越权访问时给出提示（hook 必须无条件调用，故置于任何 return 之前）。
  useEffect(() => {
    if (user && !allowed) {
      message.warning('当前账号无权访问该页面');
    }
  }, [user, allowed]);

  // 鉴权信息未就绪（有 token 但 user 尚未拉回）时先占位，避免闪现或误跳。
  if (token && !user && !authReady) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
        <Spin size="large" tip="正在校验权限..." />
      </div>
    );
  }

  if (!user) {
    // 有 token 但用户信息拉取失败（典型为 token 过期）：跳登录并带 redirect，与 AdminLayout 兜底一致，避免静默弹回首页。
    if (token) {
      const redirect = encodeURIComponent(location.pathname + location.search);
      return <Navigate to={`/login?redirect=${redirect}`} replace />;
    }
    // 完全未登录（无 token）：维持既有行为，回用户端首页。
    return <Navigate to="/" replace />;
  }

  if (!allowed) {
    // 主办方误入平台级页面 → 回到其可访问的场次管理；普通用户 → 回用户端首页。
    return canAccessAdmin(role)
      ? <Navigate to="/admin/sessions" replace />
      : <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
