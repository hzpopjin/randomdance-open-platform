import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, message, Typography, Descriptions, Alert, Space } from 'antd';
import { CrownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { updateProfile } from '../services/auth';
import { useAuthStore } from '../stores/authStore';

const { Title } = Typography;

export default function ProfilePage() {
  const { user, fetchProfile, isGuest } = useAuthStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      form.setFieldsValue({ nickname: user.nickname, phone: user.phone, email: user.email });
    }
  }, [user]);

  const handleSave = async (values: any) => {
    setLoading(true);
    try {
      const data: any = { nickname: values.nickname, phone: values.phone, email: values.email };
      if (values.password) data.password = values.password;
      await updateProfile(data);
      await fetchProfile();
      message.success('保存成功');
      form.setFieldValue('password', undefined);
      form.setFieldValue('confirmPassword', undefined);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="rd-page-shell" style={{ padding: '32px 0' }}>
      <div className="rd-container" style={{ maxWidth: 720 }}>
        {isGuest && (
          <Alert
            type="info"
            showIcon
            icon={<CrownOutlined />}
            message="游客模式"
            description="你当前以游客身份使用平台。登录或注册正式账号后，可在不同设备同步你的报名和投稿记录。"
            action={<Button size="small" type="primary" onClick={() => navigate('/login')}>登录 / 注册</Button>}
            style={{ marginBottom: 16 }}
          />
        )}
        <Card className="rd-glass-card" style={{ borderRadius: 24 }} styles={{ body: { padding: 32 } }}>
          <Title level={3} style={{ marginBottom: 24 }}>个人信息</Title>
          <Descriptions column={1} style={{ marginBottom: 24 }}>
            <Descriptions.Item label="用户名">{user?.username}</Descriptions.Item>
            <Descriptions.Item label="用户 ID">{user?.id}</Descriptions.Item>
          </Descriptions>
          <Form form={form} layout="vertical" onFinish={handleSave}>
            <Form.Item name="nickname" label="昵称"><Input /></Form.Item>
            <Form.Item name="phone" label="手机号"><Input /></Form.Item>
            <Form.Item name="email" label="邮箱"><Input /></Form.Item>
            <Form.Item name="password" label="新密码（留空则不修改）"><Input.Password /></Form.Item>
            <Form.Item name="confirmPassword" label="确认新密码" dependencies={['password']}
              rules={[({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              })]}>
              <Input.Password />
            </Form.Item>
            <Form.Item><Button type="primary" htmlType="submit" loading={loading}>保存修改</Button></Form.Item>
          </Form>
        </Card>
      </div>
    </div>
  );
}
