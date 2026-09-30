import { useEffect, useState } from 'react';
import { Spin } from 'antd';
import { useAuthStore } from '../../stores/authStore';

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, guestLogin, fetchProfile, user } = useAuthStore();
  const [tryingGuest, setTryingGuest] = useState(false);

  useEffect(() => {
    if (token && !user) {
      fetchProfile();
    } else if (!token) {
      // No token - auto-create guest session for roadshow/playlist routes
      setTryingGuest(true);
      guestLogin().finally(() => setTryingGuest(false));
    }
  }, [token, user, fetchProfile, guestLogin]);

  if (tryingGuest || (token && !user)) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
        <Spin size="large" tip="正在初始化..." />
      </div>
    );
  }

  if (!token) return null;
  return <>{children}</>;
}
