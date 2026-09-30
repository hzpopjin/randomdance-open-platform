import { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Select, Steps, Space, message, Tag, Divider, Typography } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { submitRegistration, getAvailableSessions, getOrganizers } from '../../../services/registration';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function RoadshowCreatePage() {
  const [form] = Form.useForm();
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [organizers, setOrganizers] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const navigate = useNavigate();
  // 监听已选主办方，变化时重拉其名下场次。
  const organizerId = Form.useWatch('organizer_id', form);

  useEffect(() => {
    getOrganizers().then((res) => setOrganizers(res.data.list)).catch(() => {});
  }, []);

  useEffect(() => {
    // 主办方变化时清空已选场次并重拉对应场次；未选时不拉取。
    // cancelled 守卫：快速切换主办方时，丢弃旧请求的后到响应，避免覆盖新场次列表。
    let cancelled = false;
    form.setFieldsValue({ session_id: undefined });
    if (organizerId == null) { setSessions([]); return () => { cancelled = true; }; }
    getAvailableSessions(organizerId)
      .then((res) => { if (!cancelled) setSessions(res.data.list); })
      .catch(() => { if (!cancelled) setSessions([]); });
    return () => { cancelled = true; };
  }, [organizerId, form]);

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const members = (values.members || []).map((m: any, i: number) => ({
        member_name: m.member_name, position: m.position || '', sort_order: i,
      }));
      await submitRegistration({
        session_id: values.session_id,
        song_name: values.song_name, artist_name: values.artist_name, group_name: values.group_name,
        song_format: values.song_format, edited_file_url: values.edited_file_url,
        contact_phone: values.contact_phone, members,
        has_other_performance: values.has_other_performance ? 1 : 0,
        other_performance_detail: values.other_performance_detail,
        additional_requirements: values.additional_requirements,
      });
      message.success('报名提交成功');
      navigate('/roadshow/mine');
    } catch (e: any) {
      message.error(e.message || '提交失败');
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { title: '表演信息', content: (
      <>
        <Form.Item name="organizer_id" label="主办方" rules={[{ required: true, message: '请选择主办方' }]}>
          <Select placeholder="请选择主办方" options={organizers.map((o) => ({ value: o.id, label: o.name }))} />
        </Form.Item>
        <Form.Item name="session_id" label="活动场次" rules={[{ required: true, message: '请选择场次' }]}>
          <Select placeholder={organizerId == null ? '请先选择主办方' : '请选择活动场次'} disabled={organizerId == null} options={sessions.map((s) => ({ value: s.id, label: `${s.name}（${s.event_date?.slice(0,10)}）` }))} />
        </Form.Item>
        <Form.Item name="song_name" label="表演歌曲" rules={[{ required: true, message: '请输入歌曲名' }]}>
          <Input placeholder="请输入表演歌曲名" />
        </Form.Item>
        <Form.Item name="artist_name" label="歌手" rules={[{ required: true, message: '请输入歌手名' }]}>
          <Input placeholder="请输入歌手名" />
        </Form.Item>
        <Form.Item name="group_name" label="组合名" rules={[{ required: true, message: '请输入组合名' }]}>
          <Input placeholder="请输入组合名/团队名" />
        </Form.Item>
        <Form.Item name="song_format" label="音乐类型" rules={[{ required: true, message: '请选择音乐类型' }]}>
          <Select options={[{ value: 0, label: '原版' }, { value: 1, label: '自己剪辑' }]} placeholder="请选择" />
        </Form.Item>
        <Form.Item name="edited_file_url" label="剪辑版文件链接">
          <Input placeholder="如有剪辑版音频，请粘贴链接（选填）" />
        </Form.Item>
      </>
    )},
    { title: '成员与联系', content: (
      <>
        <Form.Item name="contact_phone" label="联系方式" rules={[{ required: true, message: '请输入联系方式' }]}>
          <Input placeholder="请输入手机号" />
        </Form.Item>
        <Form.List name="members" initialValue={[{ member_name: '', position: '' }]}>
          {(fields, { add, remove }) => (
            <>
              {fields.map((field) => (
                <Space key={field.key} align="baseline" style={{ display: 'flex', marginBottom: 8 }}>
                  <Form.Item name={[field.name, 'member_name']} rules={[{ required: true, message: '请输入成员名' }]}>
                    <Input placeholder="成员姓名" />
                  </Form.Item>
                  <Form.Item name={[field.name, 'position']}>
                    <Input placeholder="位置/担当（选填）" />
                  </Form.Item>
                  <MinusCircleOutlined onClick={() => remove(field.name)} style={{ color: '#ff4d4f' }} />
                </Space>
              ))}
              <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>添加成员</Button>
            </>
          )}
        </Form.List>
        <Form.Item name="has_other_performance" label="是否有其他表演" initialValue={0}>
          <Select options={[{ value: 0, label: '否' }, { value: 1, label: '是' }]} />
        </Form.Item>
        <Form.Item name="other_performance_detail" label="其他表演说明">
          <TextArea rows={2} placeholder="如有其他表演，请说明" />
        </Form.Item>
      </>
    )},
    { title: '补充需求', content: (
      <>
        <Form.Item name="additional_requirements" label="更多需求">
          <TextArea rows={4} placeholder="如有其他需求请在此说明（选填）" />
        </Form.Item>
        <Divider />
        <Text type="secondary">请确认以上信息无误后提交报名。提交后将进入审核流程，可在「我的报名」中查看状态。</Text>
      </>
    )},
  ];

  const next = async () => {
    try {
      const fields = current === 0 ? ['organizer_id', 'session_id', 'song_name', 'artist_name', 'group_name', 'song_format'] : current === 1 ? ['contact_phone'] : [];
      if (fields.length) await form.validateFields(fields);
      setCurrent(current + 1);
    } catch {}
  };

  const prev = () => setCurrent(current - 1);

  return (
    <div className="rd-page-shell" style={{ padding: '32px 0' }}>
      <div className="rd-container">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ marginBottom: 16 }}>返回首页</Button>
        <Card className="rd-glass-card" style={{ borderRadius: 24 }} styles={{ body: { padding: 32 } }}>
          <Title level={3} style={{ marginBottom: 24 }}>路演报名</Title>
          <Steps current={current} items={steps.map((s) => ({ title: s.title }))} style={{ marginBottom: 32 }} />
          <Form form={form} layout="vertical" onFinish={onFinish}>
            {steps[current].content}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
              {current > 0 ? <Button onClick={prev}>上一步</Button> : <span />}
              {current < steps.length - 1 ? (
                <Button type="primary" onClick={next}>下一步</Button>
              ) : (
                <Button type="primary" loading={loading} onClick={() => form.submit()}>提交报名</Button>
              )}
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
}
