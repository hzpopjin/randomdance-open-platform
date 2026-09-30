import { Avatar, Button, Dropdown, Space, Typography, Tag } from 'antd';
import { HomeOutlined, LoginOutlined, LogoutOutlined, SettingOutlined, UserOutlined, CrownOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { canAccessAdmin, isOrganizer } from '../../utils/role';

const { Text } = Typography;

export default function UserHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token, authReady, logout, isGuest } = useAuthStore();
  // 超管与主办方均可进入管理后台（主办方落地后由路由守卫分流）。
  const isAdmin = canAccessAdmin(user?.role);

  const dropdownItems = [
    { key: 'home', icon: <HomeOutlined />, label: '返回首页' },
    { key: 'profile', icon: <UserOutlined />, label: '个人信息' },
    ...(isAdmin ? [{ key: 'admin', icon: <SettingOutlined />, label: '管理后台' }] : []),
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true },
  ];

  const handleDropdownClick = ({ key }: { key: string }) => {
    switch (key) {
      case 'home': navigate('/'); break;
      case 'profile': navigate('/profile'); break;
      case 'admin': navigate('/admin'); break;
      case 'logout': logout(); break;
    }
  };

  const navItems = [
    { label: '首页', path: '/' },
    { label: '路演报名', path: '/roadshow/create' },
    { label: '随舞歌单投稿', path: '/playlist/browse' },
  ];

  return (
    <div className="rd-user-header">
      <div className="rd-user-header-inner">
        <div className="rd-brand" onClick={() => navigate('/')}>
          <div className="rd-brand-mark">RD</div>
          <Text strong className="rd-brand-text">随机舞蹈中文站开放平台</Text>
        </div>
        <div className="rd-user-nav">
          {navItems.map((item) => {
            const active = location.pathname === item.path || (item.path !== '/' && location.pathname.startsWith(item.path));
            return (
              <Button key={item.path} type={active ? 'primary' : 'text'} size="middle" className="rd-user-nav-button"
                onClick={() => navigate(item.path)}
                style={{ fontWeight: active ? 700 : 600, boxShadow: active ? '0 10px 22px rgba(0, 122, 255, 0.22)' : 'none' }}>
                {item.label}
              </Button>
            );
          })}
        </div>
        <div className="rd-user-actions">
          {isAdmin && (
            <Button className="rd-admin-shortcut" icon={<SettingOutlined />} onClick={() => navigate('/admin')}>管理后台</Button>
          )}
          {!authReady ? null : token ? (
            <Dropdown menu={{ items: dropdownItems, onClick: handleDropdownClick }} placement="bottomRight">
              <button type="button" className="rd-user-avatar-trigger" aria-label="打开用户菜单" aria-haspopup="menu">
                <UserOutlined className="rd-mobile-user-icon" aria-hidden="true" />
                <Avatar className="rd-desktop-user-avatar" size={32} src={user?.avatar_url}
                  style={{ background: '#007aff' }} icon={!user?.avatar_url ? <UserOutlined /> : undefined} />
                <Space size={4} style={{ lineHeight: 1 }}>
                  <Text className="rd-user-name" ellipsis>{user?.nickname || user?.username}</Text>
                  {isGuest && <Tag color="default" style={{ fontSize: 11, margin: 0, lineHeight: '18px' }}>游客</Tag>}
                  {isAdmin && <Text type="secondary" className="rd-user-role">{isOrganizer(user?.role) ? '主办方' : '管理员'}</Text>}
                </Space>
              </button>
            </Dropdown>
          ) : (
            <Button type="primary" className="rd-login-button" icon={<LoginOutlined />} aria-label="登录" onClick={() => navigate('/login')}>
              <span className="rd-login-label">登录</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
