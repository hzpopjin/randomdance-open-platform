import { useState } from 'react';
import { Button, Card, Typography, Form, Input, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

const { Title, Text } = Typography;

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuthStore();

  const handleRegister = async (values: { username: string; password: string; nickname?: string }) => {
    setLoading(true);
    try {
      await register(values.username, values.password, values.nickname);
      message.success('注册成功');
      navigate('/', { replace: true });
    } catch (e: any) {
      message.error(e.message || '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      background: 'linear-gradient(135deg, #eef7ff 0%, #ffffff 48%, #f5f7fb 100%)' }}>
      <Card className="rd-glass-card" style={{ width: 'min(460px, 100%)', borderRadius: 24 }} styles={{ body: { padding: 40 } }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Title level={2} style={{ margin: '0 0 8px' }}>注册账号</Title>
          <Text type="secondary">创建你的随机舞蹈开放平台账号</Text>
        </div>
        <Form name="register" onFinish={handleRegister} autoComplete="off" size="large" layout="vertical">
          <Form.Item name="username" label="用户名" rules={[
            { required: true, message: '请输入用户名' },
            { min: 3, message: '用户名至少 3 个字符' },
            { pattern: /^[a-zA-Z0-9_]+$/, message: '只能包含字母、数字和下划线' },
          ]}>
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item name="nickname" label="昵称（可选）">
            <Input placeholder="请输入昵称" />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[
            { required: true, message: '请输入密码' },
            { min: 6, message: '密码至少 6 个字符' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
          </Form.Item>
          <Form.Item name="confirm" label="确认密码" dependencies={['password']} rules={[
            { required: true, message: '请确认密码' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue('password') === value) return Promise.resolve();
                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="请再次输入密码" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" loading={loading} block size="large">注册</Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            已有账号？ <RouterLink to="/login">返回登录</RouterLink>
          </Text>
        </div>
      </Card>
    </div>
  );
}
