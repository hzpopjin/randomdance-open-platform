import { createBrowserRouter, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import { Spin } from 'antd';
import AdminLayout from '../components/layout/AdminLayout';
import UserHeader from '../components/layout/UserHeader';
import RequireAuth from '../components/auth/RequireAuth';
import HomePage from '../pages/home/index';
import DashboardPage from '../pages/dashboard/index';
import SessionListPage from '../pages/session/index';
import RoadshowListPage from '../pages/roadshow/index';
import RoadshowCreatePage from '../pages/roadshow/create/index';
import MyRegistrationsPage from '../pages/roadshow/mine/index';
import RoadshowPositionPage from '../pages/roadshow/position/index';
import SubmissionListPage from '../pages/submission/list/index';
import SubmissionDetailPage from '../pages/submission/detail/index';
import SubmissionStatisticsPage from '../pages/submission/statistics/index';
import SongListPage from '../pages/song/list/index';
import PendingSongPage from '../pages/song/pending/index';
import PlaylistPage from '../pages/playlist/index';
import UserListPage from '../pages/user/index';
import LoginPage from '../pages/login/index';
import RegisterPage from '../pages/register/index';
import AdminProfilePage from '../pages/admin/profile';
import PlaylistBrowsePage from '../pages/playlist/browse/index';
import MySubmissionsPage from '../pages/playlist/mine/index';
import SubmissionUserDetailPage from '../pages/playlist/detail/index';
import ClientEventsPage from '../pages/client-events/index';
import SystemLogsPage from '../pages/system-logs/index';
import ApiDocsPage from '../pages/api-docs/index';
import ProfilePage from '../pages/profile';
import { useAuthStore } from '../stores/authStore';
import RequireRole from '../components/auth/RequireRole';
import { canAccessAdmin, isSuperAdmin } from '../utils/role';

// 管理端新增页面（对象存储 / 编排 / 媒体 / 主办方）采用路由级懒加载拆包，降低主包体积。
const RoadshowMediaUploadPage = lazy(() => import('../pages/roadshow/media/index'));
const RoadshowArrangementPage = lazy(() => import('../pages/roadshow/arrangement/index'));
const ObjectStoragePage = lazy(() => import('../pages/object-storage/index'));
const OrganizerPage = lazy(() => import('../pages/organizer/index'));

function RouteFallback() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
      <Spin size="large" />
    </div>
  );
}

function AuthInit() {
  const { token, user, fetchProfile, setAuthReady } = useAuthStore();
  useEffect(() => {
    if (token && !user) fetchProfile();
    else if (!token) setAuthReady(true);
  }, [fetchProfile, setAuthReady, token, user]);
  return null;
}

function RootLayout() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin');
  return (
    <>
      <AuthInit />
      {!isAdmin && <UserHeader />}
      <Outlet />
    </>
  );
}

// /admin 默认落地页：按角色感知跳转（超管 → 数据大屏，主办方 → 场次管理）。
function AdminIndexRedirect() {
  const { user, token, authReady } = useAuthStore();
  if (token && !user && !authReady) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', minHeight: 240 }}>
        <Spin size="large" />
      </div>
    );
  }
  const role = user?.role;
  if (isSuperAdmin(role)) return <Navigate to="/admin/dashboard" replace />;
  if (canAccessAdmin(role)) return <Navigate to="/admin/sessions" replace />;
  return <Navigate to="/" replace />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/roadshow/create', element: <RequireAuth><RoadshowCreatePage /></RequireAuth> },
      { path: '/roadshow/mine', element: <RequireAuth><MyRegistrationsPage /></RequireAuth> },
      { path: '/roadshow/position/:id', element: <RequireAuth><RoadshowPositionPage /></RequireAuth> },
      { path: '/roadshow/media', element: <RequireAuth><Suspense fallback={<RouteFallback />}><RoadshowMediaUploadPage /></Suspense></RequireAuth> },
      { path: '/playlist/browse', element: <RequireAuth><PlaylistBrowsePage /></RequireAuth> },
      { path: '/playlist/mine', element: <RequireAuth><MySubmissionsPage /></RequireAuth> },
      { path: '/playlist/detail/:id', element: <RequireAuth><SubmissionUserDetailPage /></RequireAuth> },
      { path: '/profile', element: <RequireAuth><ProfilePage /></RequireAuth> },
      {
        path: '/admin',
        element: <AdminLayout />,
        children: [
          { index: true, element: <AdminIndexRedirect /> },
          { path: 'dashboard', element: <RequireRole roles={[1]}><DashboardPage /></RequireRole> },
          { path: 'sessions', element: <SessionListPage /> },
          { path: 'roadshow', element: <RoadshowListPage /> },
          { path: 'roadshow/arrangement', element: <Suspense fallback={<RouteFallback />}><RoadshowArrangementPage /></Suspense> },
          { path: 'object-storage', element: <RequireRole roles={[1]}><Suspense fallback={<RouteFallback />}><ObjectStoragePage /></Suspense></RequireRole> },
          { path: 'organizers', element: <RequireRole roles={[1]}><Suspense fallback={<RouteFallback />}><OrganizerPage /></Suspense></RequireRole> },
          {
            path: 'submissions',
            children: [
              { index: true, element: <Navigate to="/admin/submissions/list" replace /> },
              { path: 'list', element: <SubmissionListPage /> },
              { path: ':id/detail', element: <SubmissionDetailPage /> },
              { path: 'statistics', element: <SubmissionStatisticsPage /> },
            ],
          },
          {
            path: 'songs',
            children: [
              { index: true, element: <Navigate to="/admin/songs/list" replace /> },
              { path: 'list', element: <RequireRole roles={[1]}><SongListPage /></RequireRole> },
              { path: 'pending', element: <RequireRole roles={[1]}><PendingSongPage /></RequireRole> },
            ],
          },
          { path: 'playlist', element: <RequireRole roles={[1]}><PlaylistPage /></RequireRole> },
          { path: 'users', element: <RequireRole roles={[1]}><UserListPage /></RequireRole> },
          { path: 'profile', element: <AdminProfilePage /> },
          { path: 'client-events', element: <RequireRole roles={[1]}><ClientEventsPage /></RequireRole> },
          { path: 'system-logs', element: <RequireRole roles={[1]}><SystemLogsPage /></RequireRole> },
          { path: 'api-docs', element: <RequireRole roles={[1]}><ApiDocsPage /></RequireRole> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);
