import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Input, Button, message, Space, Popconfirm, Modal, Form, Typography, Divider,
} from 'antd';
import { PlusOutlined, EditOutlined, StopOutlined, CheckCircleOutlined, UserDeleteOutlined } from '@ant-design/icons';
import {
  getUsers, createUser, updateUser, updateUserRole, updateUserStatus,
} from '../../services/users';
import { useAuthStore } from '../../stores/authStore';
import { ROLE_ADMIN, ROLE_USER, ROLE_ORGANIZER } from '../../utils/role';
import type { User } from '../../types/user';
import dayjs from 'dayjs';

const { Text } = Typography;
const PAGE_SIZE = 10;

interface OrganizerFormValues {
  username: string;
  password: string;
  organizer_name: string;
  nickname?: string;
  phone?: string;
  email?: string;
}

export default function OrganizerPage() {
  const [form] = Form.useForm<OrganizerFormValues>();
  const { user: currentUser } = useAuthStore();
  const [list, setList] = useState<User[]>([]);
  const [systemOrganizers, setSystemOrganizers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);

  // 主办方列表（role=2），服务端分页。
  const fetchOrganizers = useCallback(async (p = 1, kw = '') => {
    setLoading(true);
    try {
      const res = await getUsers({ role: ROLE_ORGANIZER, page: p, page_size: PAGE_SIZE, keyword: kw || undefined });
      setList(res.data.list);
      setTotal(res.data.total);
      setPage(p);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // 系统主办方：role=1 且 organizer_name 非空的管理员，只读置顶。
  const fetchSystemOrganizers = useCallback(async () => {
    try {
      const res = await getUsers({ role: ROLE_ADMIN, page: 1, page_size: 100 });
      setSystemOrganizers(res.data.list.filter((u) => !!u.organizer_name));
    } catch {
      // 系统主办方仅作展示，拉取失败不打断主流程。
    }
  }, []);

  useEffect(() => {
    fetchOrganizers(1);
    fetchSystemOrganizers();
  }, [fetchOrganizers, fetchSystemOrganizers]);

  const refresh = (p = page) => {
    fetchOrganizers(p, keyword);
    fetchSystemOrganizers();
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: User) => {
    setEditing(record);
    form.setFieldsValue({
      username: record.username,
      password: '',
      organizer_name: record.organizer_name || '',
      nickname: record.nickname,
      phone: record.phone || '',
      email: record.email || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (editing) {
        await updateUser(editing.id, {
          nickname: values.nickname?.trim() || undefined,
          phone: values.phone?.trim() || undefined,
          email: values.email?.trim() || undefined,
          organizer_name: values.organizer_name.trim(),
        });
        message.success('主办方已更新');
      } else {
        await createUser({
          username: values.username.trim(),
          password: values.password,
          nickname: values.nickname?.trim() || undefined,
          phone: values.phone?.trim() || undefined,
          email: values.email?.trim() || undefined,
          role: ROLE_ORGANIZER,
          organizer_name: values.organizer_name.trim(),
        });
        message.success('主办方已创建');
      }
      setModalOpen(false);
      form.resetFields();
      setEditing(null);
      refresh(editing ? page : 1);
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验失败：antd 已内联提示，不提交、不弹错误 toast
      message.error(e.message);
    }
  };

  const handleToggleStatus = async (record: User) => {
    const nextStatus = record.status === 1 ? 0 : 1;
    try {
      await updateUserStatus(record.id, nextStatus);
      message.success(nextStatus === 1 ? '已启用' : '已停用');
      refresh();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const handleRevoke = async (record: User) => {
    try {
      await updateUserRole(record.id, ROLE_USER);
      message.success('已取消主办方身份');
      refresh();
    } catch (e: any) {
      message.error(e.message);
    }
  };

  const statusTag = (status?: number) =>
    status === 0 ? <Tag color="default">停用</Tag> : <Tag color="success">启用</Tag>;

  // 主办方（role=2）表格列。
  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username' },
    { title: '对外展示名', dataIndex: 'organizer_name', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: '昵称', dataIndex: 'nickname', render: (v: string) => v || <Text type="secondary">—</Text> },
    { title: '手机', dataIndex: 'phone', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: '邮箱', dataIndex: 'email', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: '状态', dataIndex: 'status', width: 80, render: statusTag },
    { title: '创建时间', dataIndex: 'created_at', width: 150, render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—') },
    {
      title: '操作', width: 220, render: (_: unknown, r: User) => {
        // 防自锁：不提供对当前登录账号自身的操作。
        if (currentUser && r.id === currentUser.id) {
          return <Text type="secondary">当前账号</Text>;
        }
        return (
          <Space size={4}>
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>编辑</Button>
            <Popconfirm
              title={r.status === 1 ? '确认停用该主办方账号？' : '确认启用该主办方账号？'}
              description={r.status === 1 ? '停用后该账号无法登录，已签发 token 立即失效。' : undefined}
              onConfirm={() => handleToggleStatus(r)}
            >
              <Button size="small" icon={r.status === 1 ? <StopOutlined /> : <CheckCircleOutlined />}>
                {r.status === 1 ? '停用' : '启用'}
              </Button>
            </Popconfirm>
            <Popconfirm
              title="确认取消该账号的主办方身份？"
              description="其名下场次将保留归属，但该账号不再能登录管理后台。"
              onConfirm={() => handleRevoke(r)}
            >
              <Button size="small" danger icon={<UserDeleteOutlined />}>取消身份</Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  // 系统主办方（role=1）只读列：不含停用/降级操作。
  const systemColumns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '用户名', dataIndex: 'username',
      render: (v: string) => <Space size={6}>{v}<Tag color="blue">系统主办方</Tag></Space>,
    },
    { title: '对外展示名', dataIndex: 'organizer_name', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: '昵称', dataIndex: 'nickname', render: (v: string) => v || <Text type="secondary">—</Text> },
    { title: '手机', dataIndex: 'phone', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: '邮箱', dataIndex: 'email', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: '状态', dataIndex: 'status', width: 80, render: statusTag },
    { title: '创建时间', dataIndex: 'created_at', width: 150, render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—') },
    { title: '操作', width: 120, render: () => <Text type="secondary">只读</Text> },
  ];

  return (
    <Card
      title="主办方管理"
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建主办方</Button>}
    >
      {systemOrganizers.length > 0 && (
        <>
          <Text type="secondary">
            系统主办方为超级管理员账号本身，历史场次默认归属其名下，仅作只读展示，不可停用或降级。
          </Text>
          <Table
            style={{ marginTop: 12 }}
            size="small"
            columns={systemColumns}
            dataSource={systemOrganizers}
            rowKey="id"
            pagination={false}
          />
          <Divider style={{ margin: '20px 0 16px' }}>主办方账号</Divider>
        </>
      )}
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索用户名/昵称/手机"
          style={{ width: 280 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={() => fetchOrganizers(1, keyword)}
          allowClear
        />
      </Space>
      <Table
        columns={columns}
        dataSource={list}
        rowKey="id"
        loading={loading}
        pagination={{ current: page, total, pageSize: PAGE_SIZE, onChange: (p) => fetchOrganizers(p, keyword) }}
      />

      <Modal
        title={editing ? '编辑主办方' : '新建主办方'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditing(null); form.resetFields(); }}
        onOk={handleSave}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            name="username"
            label="用户名"
            rules={editing ? [] : [{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="登录用户名" disabled={!!editing} autoComplete="off" />
          </Form.Item>
          {!editing && (
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }, { min: 6, message: '密码至少 6 位' }]}
            >
              <Input.Password placeholder="登录密码" autoComplete="new-password" />
            </Form.Item>
          )}
          <Form.Item
            name="organizer_name"
            label="对外展示名"
            rules={[{ required: true, message: '请输入对外展示名' }]}
            extra="将展示在公共主办方列表与场次归属中"
          >
            <Input placeholder="如：某某舞团" />
          </Form.Item>
          <Form.Item name="nickname" label="昵称">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="phone" label="手机">
            <Input placeholder="选填" />
          </Form.Item>
          <Form.Item name="email" label="邮箱" rules={[{ type: 'email', message: '邮箱格式不正确' }]}>
            <Input placeholder="选填" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
