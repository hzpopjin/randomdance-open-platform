import React, { useState, useMemo, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Breadcrumb, theme, Button, Typography, Spin, Tag, message } from 'antd';
import {
  DashboardOutlined, CalendarOutlined, FileTextOutlined, PlaySquareOutlined,
  UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined, HomeOutlined,
  FileSearchOutlined, CloudServerOutlined, TeamOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';
import { canAccessAdmin, isOrganizer, isSuperAdmin } from '../../utils/role';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, logout, authReady } = useAuthStore();
  const { token: themeToken } = theme.useToken();

  useEffect(() => {
    if (!token) navigate('/login', { replace: true });
  }, [token, navigate]);

  // 菜单按角色分层，fail-closed：仅超管/主办方各自可见，role=0 或角色未加载时返回空菜单，避免首帧闪现超管项。
  const menuItems = useMemo(() => {
    const role = user?.role;
    // 超管（role=1）全量菜单。
    if (isSuperAdmin(role)) {
      return [
        { key: '/admin/dashboard', icon: <DashboardOutlined />, label: '数据大屏' },
        { key: '/admin/sessions', icon: <CalendarOutlined />, label: '场次管理' },
        { key: '/admin/notification-drafts', icon: <FileTextOutlined />, label: '通知草稿与预览' },
        {
          key: 'sub-roadshow', icon: <UserOutlined />, label: '路演管理',
          children: [
            { key: '/admin/roadshow', label: '报名管理' },
            { key: '/admin/roadshow/arrangement', label: '路演编排' },
          ],
        },
        {
          key: '/admin/submissions', icon: <FileTextOutlined />, label: '歌单投稿',
          children: [
            { key: '/admin/submissions/list', label: '投稿列表' },
            { key: '/admin/submissions/statistics', label: '投稿统计' },
          ],
        },
        {
          key: '/admin/songs', icon: <FileTextOutlined />, label: '歌曲管理',
          children: [
            { key: '/admin/songs/list', label: '歌曲库' },
            { key: '/admin/songs/pending', label: '待审核歌曲' },
          ],
        },
        { key: '/admin/playlist', icon: <PlaySquareOutlined />, label: '随机舞蹈歌单' },
        { key: '/admin/organizers', icon: <TeamOutlined />, label: '主办方管理' },
        { key: '/admin/object-storage', icon: <CloudServerOutlined />, label: '对象存储配置' },
        { key: '/admin/users', icon: <UserOutlined />, label: '用户管理' },
        { key: '/admin/client-events', icon: <FileSearchOutlined />, label: '日志浏览' },
        { key: '/admin/system-logs', icon: <FileSearchOutlined />, label: '系统日志' },
        { key: '/admin/api-docs', icon: <FileTextOutlined />, label: 'API 文档' },
      ];
    }
    // 主办方（role=2）精简菜单：场次管理、路演管理、歌单投稿。
    if (isOrganizer(role)) {
      return [
        { key: '/admin/sessions', icon: <CalendarOutlined />, label: '场次管理' },
        { key: '/admin/notification-drafts', icon: <FileTextOutlined />, label: '通知草稿与预览' },
        {
          key: 'sub-roadshow', icon: <UserOutlined />, label: '路演管理',
          children: [
            { key: '/admin/roadshow', label: '报名管理' },
            { key: '/admin/roadshow/arrangement', label: '路演编排' },
          ],
        },
        {
          key: '/admin/submissions', icon: <FileTextOutlined />, label: '歌单投稿',
          children: [
            { key: '/admin/submissions/list', label: '投稿列表' },
            { key: '/admin/submissions/statistics', label: '投稿统计' },
          ],
        },
      ];
    }
    // role=0（普通用户）或角色尚未加载（undefined）：fail-closed，不渲染任何菜单项。
    return [];
  }, [user?.role]);

  // 角色守卫：登录后拉取的 /auth/profile 中 role 不可进入后台时，重定向到用户端并提示。
  // （后端已拦数据，此处补前端守卫与体验）
  useEffect(() => {
    if (!token || !user) return;
    if (!canAccessAdmin(user.role)) {
      message.warning('当前账号无管理端访问权限，已为你跳转到用户端');
      navigate('/', { replace: true });
    }
  }, [token, user, navigate]);

  // 等待鉴权信息就绪，避免非管理员账号闪现管理端内容。
  if (token && !user && !authReady) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <Spin size="large" tip="正在校验权限..." />
      </div>
    );
  }

  const selectedKeys = [location.pathname];
  const openKeys: string[] = [];
  if (location.pathname.startsWith('/admin/submissions')) openKeys.push('/admin/submissions');
  if (location.pathname.startsWith('/admin/songs')) openKeys.push('/admin/songs');
  if (location.pathname.startsWith('/admin/roadshow')) openKeys.push('sub-roadshow');

  const dropdownItems = [
    { key: 'home', icon: <HomeOutlined />, label: '返回首页' },
    { key: 'profile', icon: <UserOutlined />, label: '个人信息' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

  const handleDropdownClick = ({ key }: { key: string }) => {
    if (key === 'home') navigate('/');
    if (key === 'profile') navigate('/admin/profile');
    if (key === 'logout') logout();
  };

  const handleMenuClick = ({ key }: { key: string }) => {
    if (key.startsWith('/admin')) navigate(key);
  };

  const isDashboard = location.pathname === '/admin/dashboard';

  return (
    <Layout className="rd-admin-layout" style={{ minHeight: '100vh', background: '#f5f7fb' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="light" width={232}
        style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100,
          background: 'rgba(255,255,255,0.94)', borderRight: '1px solid #e6eaf2', boxShadow: '8px 0 30px rgba(15,23,42,0.04)' }}>
        <div style={{ height: 72, display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
          gap: 12, padding: collapsed ? 0 : '0 20px', borderBottom: '1px solid #eef2f7' }}>
          <div style={{ width: 38, height: 38, borderRadius: 15, display: 'grid', placeItems: 'center', color: '#fff',
            background: 'linear-gradient(135deg, #007aff 0%, #24a8ff 100%)', boxShadow: '0 12px 24px rgba(0, 122, 255, 0.22)',
            fontWeight: 800, flexShrink: 0 }}>RD</div>
          {!collapsed && (
            <div style={{ minWidth: 0 }}>
              <Text strong style={{ display: 'block', fontSize: 16 }}>随机舞蹈</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>开放平台后台</Text>
            </div>
          )}
        </div>
        <Menu theme="light" mode="inline" selectedKeys={selectedKeys} defaultOpenKeys={openKeys}
          items={menuItems} onClick={handleMenuClick} style={{ padding: '14px 0', background: 'transparent' }} />
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 232, transition: 'margin-left 0.2s', background: '#f5f7fb' }}>
        <Header style={{ height: 72, padding: '0 28px', background: 'rgba(255, 255, 255, 0.88)', backdropFilter: 'blur(18px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e6eaf2',
          position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
            <Button type="text" shape="circle" icon={React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined)}
              onClick={() => setCollapsed(!collapsed)} />
            <Breadcrumb items={[{ title: <span style={{ cursor: 'pointer' }} onClick={() => navigate('/')}>首页</span> }, { title: location.pathname.split('/').filter(Boolean).slice(1).join(' / ') || '管理' }]} />
          </div>
          <Dropdown menu={{ items: dropdownItems, onClick: handleDropdownClick }} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44, lineHeight: 'normal', cursor: 'pointer',
              padding: '5px 12px 5px 5px', borderRadius: 999, background: '#f7f9fc', border: '1px solid #e6eaf2' }}>
              <Avatar size={34} src={user?.avatar_url} style={{ background: themeToken.colorPrimary }}
                icon={!user?.avatar_url ? <UserOutlined /> : undefined} />
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 600 }}>{user?.nickname || user?.username || '管理员'}</span>
                  {isSuperAdmin(user?.role)
                    ? <Tag color="blue" style={{ margin: 0, lineHeight: '18px' }}>超级管理员</Tag>
                    : isOrganizer(user?.role)
                      ? <Tag color="gold" style={{ margin: 0, lineHeight: '18px' }}>主办方</Tag>
                      : <Tag style={{ margin: 0, lineHeight: '18px' }}>普通用户</Tag>}
                </span>
                {isOrganizer(user?.role) && user?.organizer_name && (
                  <Text type="secondary" style={{ fontSize: 12 }}>{user.organizer_name}</Text>
                )}
              </div>
            </div>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, padding: isDashboard ? 0 : 24, background: isDashboard ? 'transparent' : '#ffffff',
          borderRadius: isDashboard ? 0 : 24, border: isDashboard ? 'none' : '1px solid #e6eaf2',
          boxShadow: isDashboard ? 'none' : '0 18px 48px rgba(15, 23, 42, 0.06)', minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
