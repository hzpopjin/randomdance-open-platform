import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, InputNumber, DatePicker, message, Tag, Space, Popconfirm, Switch, Divider, Select, Typography } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, StopOutlined, UndoOutlined } from '@ant-design/icons';
import { getSessions, createSession, updateSession, deleteSession, cancelSession, restoreSession } from '../../services/sessions';
import { getOrganizers } from '../../services/registration';
import { useAuthStore } from '../../stores/authStore';
import { isSuperAdmin } from '../../utils/role';
import dayjs from 'dayjs';

const { Text } = Typography;

export default function SessionListPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();
  // 主办方选项（公共接口）；首项为系统主办方。
  const [organizers, setOrganizers] = useState<{ id: number; name: string }[]>([]);
  const { user: currentUser } = useAuthStore();
  const isSuper = isSuperAdmin(currentUser?.role);

  const fetchData = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getSessions({ page: p, page_size: 10 });
      setData(res.data.list); setTotal(res.data.total); setPage(p);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    // 主办方列表供超管新建/编辑场次时指定归属（无需鉴权）。
    getOrganizers().then((res) => setOrganizers(res.data.list)).catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload: any = {
        ...values,
        event_date: values.event_date?.format('YYYY-MM-DD HH:mm:ss'),
        registration_start: values.registration_start?.format('YYYY-MM-DD HH:mm:ss') || null,
        registration_end: values.registration_end?.format('YYYY-MM-DD HH:mm:ss') || null,
        roadshow_selection_enabled: !!values.roadshow_selection_enabled,
        roadshow_selection_open_at: values.roadshow_selection_open_at
          ? values.roadshow_selection_open_at.format('YYYY-MM-DD HH:mm:ss')
          : null,
        // 后端 assertRoadshowSelectionConfig 要求创建/更新时均为有效整数（TypeORM create 不会应用 DB 默认值）
        roadshow_slot_minutes: Number(values.roadshow_slot_minutes ?? 5),
        roadshow_halftime_delay_minutes: Number(values.roadshow_halftime_delay_minutes ?? 60),
      };
      // 主办方登录时不提交 organizer_id（由后端强制为自身）；仅超管可显式指定归属。
      if (!isSuper) delete payload.organizer_id;
      if (editing) await updateSession(editing.id, payload);
      else await createSession(payload);
      message.success(editing ? '更新成功' : '创建成功');
      setModalOpen(false); form.resetFields(); setEditing(null);
      fetchData(page);
    } catch (e: any) { if (e?.errorFields) return; message.error(e.message); }
  };

  const handleEdit = (record: any) => {
    setEditing(record);
    form.setFieldsValue({
      ...record,
      event_date: record.event_date ? dayjs(record.event_date) : null,
      registration_start: record.registration_start ? dayjs(record.registration_start) : null,
      registration_end: record.registration_end ? dayjs(record.registration_end) : null,
      roadshow_selection_enabled: !!record.roadshow_selection_enabled,
      roadshow_selection_open_at: record.roadshow_selection_open_at ? dayjs(record.roadshow_selection_open_at) : null,
      roadshow_slot_minutes: record.roadshow_slot_minutes ?? 5,
      roadshow_halftime_delay_minutes: record.roadshow_halftime_delay_minutes ?? 60,
    });
    setModalOpen(true);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '场次名称', dataIndex: 'name' },
    { title: '活动日期', dataIndex: 'event_date', render: (v: string) => v?.slice(0, 16).replace('T', ' ') },
    { title: '地点', dataIndex: 'location' },
    { title: '主办方', dataIndex: 'organizer_name', width: 130, render: (v: string | null) => v || <Text type="secondary">未归属</Text> },
    { title: '报名数', dataIndex: 'registration_count', width: 80 },
    { title: '投稿数', dataIndex: 'submission_count', width: 80 },
    { title: '状态', dataIndex: 'is_cancelled', width: 80, render: (v: boolean) => v ? <Tag color="red">已取消</Tag> : <Tag color="green">正常</Tag> },
    { title: '操作', width: 200, render: (_: any, r: any) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
        {r.is_cancelled ? <Button size="small" icon={<UndoOutlined />} onClick={() => restoreSession(r.id).then(() => fetchData(page))} /> : <Button size="small" icon={<StopOutlined />} onClick={() => cancelSession(r.id).then(() => fetchData(page))} />}
        <Popconfirm title="确认删除？" onConfirm={() => deleteSession(r.id).then(() => fetchData(page)).catch((e) => message.error(e.response?.data?.message || '删除失败'))}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <Card title="场次管理" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); if (isSuper) form.setFieldsValue({ organizer_id: organizers[0]?.id }); setModalOpen(true); }}>新建场次</Button>}>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, total, pageSize: 10, onChange: fetchData }} />
      <Modal title={editing ? '编辑场次' : '新建场次'} open={modalOpen} onCancel={() => { setModalOpen(false); setEditing(null); }} onOk={handleSave} width={600}>
        <Form form={form} layout="vertical" initialValues={{ roadshow_selection_enabled: false, roadshow_slot_minutes: 5, roadshow_halftime_delay_minutes: 60 }}>
          {isSuper ? (
            <Form.Item name="organizer_id" label="主办方" extra="默认归属系统主办方（首项），可改派给其他主办方">
              <Select placeholder="请选择主办方" options={organizers.map((o) => ({ value: o.id, label: o.name }))} allowClear />
            </Form.Item>
          ) : (
            <Form.Item label="主办方" extra="场次将自动归属于当前主办方账号">
              <Input value={currentUser?.organizer_name || currentUser?.nickname || currentUser?.username || ''} disabled />
            </Form.Item>
          )}
          <Form.Item name="name" label="场次名称" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="event_date" label="活动日期" rules={[{ required: true }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="location" label="地点" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="registration_start" label="报名开始时间"><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="registration_end" label="报名结束时间"><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="venue_info" label="场地信息"><Input.TextArea rows={2} /></Form.Item>
          <Divider style={{ margin: '8px 0 16px' }}>路演选位配置</Divider>
          <Form.Item name="roadshow_selection_enabled" label="开放用户选位" valuePropName="checked"
            extra="开启后用户可在选位面板抢位；必须设置开放时间，且开放时间需早于活动开始时间">
            <Switch checkedChildren="开放" unCheckedChildren="关闭" />
          </Form.Item>
          <Form.Item name="roadshow_selection_open_at" label="选位开放时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Space size={16} style={{ display: 'flex' }}>
            <Form.Item name="roadshow_slot_minutes" label="每组时长（分钟）" rules={[{ required: true, message: '请输入 1-60 的整数' }]} style={{ flex: 1 }}>
              <InputNumber min={1} max={60} precision={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="roadshow_halftime_delay_minutes" label="中场延后（分钟）" rules={[{ required: true, message: '请输入 0-360 的整数' }]} style={{ flex: 1 }}>
              <InputNumber min={0} max={360} precision={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </Card>
  );
}
