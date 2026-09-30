import { useState } from 'react';
import { Button, Card, Row, Col, Typography, Form, Input, message } from 'antd';
import { UserOutlined, LockOutlined, LoginOutlined, SafetyCertificateOutlined, HomeOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { isSuperAdmin, isOrganizer } from '../../utils/role';

const { Title, Text, Paragraph } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuthStore();

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      const redirect = searchParams.get('redirect');
      // 优先尊重 redirect 回跳（保证游客/普通用户被拦截后的回跳不受影响）。
      if (redirect) {
        navigate(redirect, { replace: true });
        return;
      }
      // 无 redirect 时按角色分流：超管 → 数据大屏，主办方 → 场次管理，普通用户 → 首页。
      const role = useAuthStore.getState().user?.role;
      if (isSuperAdmin(role)) navigate('/admin/dashboard', { replace: true });
      else if (isOrganizer(role)) navigate('/admin/sessions', { replace: true });
      else navigate('/', { replace: true });
    } catch (e: any) {
      message.error(e.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      background: 'linear-gradient(135deg, #eef7ff 0%, #ffffff 48%, #f5f7fb 100%)' }}>
      <Card className="rd-glass-card" style={{ width: 'min(980px, 100%)', overflow: 'hidden', borderRadius: 30 }} styles={{ body: { padding: 0 } }}>
        <Row>
          <Col xs={24} lg={12}>
            <div style={{ minHeight: 560, height: '100%', padding: '56px 44px', color: '#fff',
              background: 'linear-gradient(145deg, rgba(0,122,255,0.92), rgba(36,168,255,0.76))',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: 16, display: 'grid', placeItems: 'center',
                    background: 'rgba(255,255,255,0.22)', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.28)', fontWeight: 800 }}>RD</div>
                  <Text strong style={{ color: '#fff', fontSize: 18 }}>DANCE</Text>
                </div>
                <Button
                  type="text"
                  size="small"
                  icon={<HomeOutlined />}
                  onClick={() => navigate('/')}
                  style={{ color: 'rgba(255,255,255,0.85)', background: 'rgba(255,255,255,0.15)' }}
                >
                  返回首页
                </Button>
              </div>
              <div>
                <div className="rd-pill" style={{ background: 'rgba(255,255,255,0.18)', borderColor: 'rgba(255,255,255,0.26)', color: '#fff' }}>
                  <SafetyCertificateOutlined /> 随机舞蹈中文站开放平台
                </div>
                <Title style={{ color: '#fff', margin: '24px 0 16px', fontSize: 46, lineHeight: 1.08 }}>登录开放平台</Title>
                <Paragraph style={{ color: 'rgba(255,255,255,0.82)', fontSize: 17, lineHeight: 1.8, margin: 0 }}>
                  管理报名、投稿歌单、查看活动记录，让每一次活动流转都清晰顺畅。
                </Paragraph>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>不想登录？</Text>
                <Button
                  size="small"
                  ghost
                  icon={<HomeOutlined />}
                  onClick={() => navigate('/')}
                  style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}
                >
                  以游客身份浏览
                </Button>
              </div>
            </div>
          </Col>
          <Col xs={24} lg={12}>
            <div style={{ padding: '64px 46px', minHeight: 560, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ marginBottom: 30 }}>
                <Title level={2} style={{ margin: 0 }}>欢迎回来</Title>
                <Text type="secondary">使用平台账号登录</Text>
              </div>
              <Form name="userLogin" onFinish={handleLogin} autoComplete="off" size="large" layout="vertical">
                <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                  <Input prefix={<UserOutlined />} placeholder="请输入用户名" autoComplete="username" />
                </Form.Item>
                <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
                  <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" autoComplete="current-password" />
                </Form.Item>
                <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
                  <Button type="primary" htmlType="submit" loading={loading} block icon={<LoginOutlined />} size="large">登录</Button>
                </Form.Item>
              </Form>
              <div style={{ textAlign: 'center', marginTop: 22 }}>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  还没有账号？ <Link to="/register">立即注册</Link>
                </Text>
              </div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
