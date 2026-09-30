import { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Input, Button, message, Space, Popconfirm, Select, Modal, Form, Typography,
} from 'antd';
import { StopOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { getUsers, updateUserRole, updateUserStatus } from '../../services/users';
import { useAuthStore } from '../../stores/authStore';
import { ROLE_USER, ROLE_ADMIN, ROLE_ORGANIZER } from '../../utils/role';
import type { User } from '../../types/user';
import dayjs from 'dayjs';

const { Text } = Typography;
const PAGE_SIZE = 10;

// 角色 → Tag 颜色与文案。
function renderRoleTag(role: number) {
  if (Number(role) === ROLE_ADMIN) return <Tag color="red">管理员</Tag>;
  if (Number(role) === ROLE_ORGANIZER) return <Tag color="gold">主办方</Tag>;
  return <Tag>普通用户</Tag>;
}

export default function UserListPage() {
  const [form] = Form.useForm<{ organizer_name: string }>();
  const { user: currentUser } = useAuthStore();
  const [data, setData] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [roleFilter, setRoleFilter] = useState<number | undefined>(undefined);
  // 升级为「主办方」但缺少对外展示名时，弹窗收集 organizer_name。
  const [promoting, setPromoting] = useState<User | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);

  const fetchData = useCallback(async (p = 1, kw = '', role?: number) => {
    setLoading(true);
    try {
      const res = await getUsers({ page: p, page_size: PAGE_SIZE, keyword: kw || undefined, role });
      setData(res.data.list);
      setTotal(res.data.total);
      setPage(p);
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(1, '', roleFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = (p = page) => fetchData(p, keyword, roleFilter);

  // 角色下拉变更：升为主办方且无对外展示名时先弹窗补填。
  const handleRoleChange = (record: User, newRole: number) => {
    if (newRole === ROLE_ORGANIZER && !record.organizer_name) {
      setPromoting(record);
      form.resetFields();
      setPromoteOpen(true);
      return;
    }
    updateUserRole(record.id, newRole)
      .then(() => { message.success('角色已更新'); refresh(); })
      .catch((e: any) => message.error(e.message));
  };

  const submitPromote = async () => {
    if (!promoting) return;
    try {
      const values = await form.validateFields();
      await updateUserRole(promoting.id, ROLE_ORGANIZER, values.organizer_name.trim());
      message.success('已升级为主办方');
      setPromoteOpen(false);
      setPromoting(null);
      form.resetFields();
      refresh();
    } catch (e: any) {
      if (e?.errorFields) return; // 表单校验失败：antd 已内联提示，不提交、不弹错误 toast
      message.error(e.message);
    }
  };

  const handleToggleStatus = (record: User) => {
    const nextStatus = record.status === 1 ? 0 : 1;
    updateUserStatus(record.id, nextStatus)
      .then(() => { message.success(nextStatus === 1 ? '已启用' : '已停用'); refresh(); })
      .catch((e: any) => message.error(e.message));
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username' },
    { title: '昵称', dataIndex: 'nickname', render: (v: string) => v || <Text type="secondary">—</Text> },
    { title: '手机', dataIndex: 'phone', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: '邮箱', dataIndex: 'email', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    { title: '角色', dataIndex: 'role', width: 90, render: renderRoleTag },
    {
      title: '对外展示名', dataIndex: 'organizer_name', width: 140,
      render: (v: string | null) => v || <Text type="secondary">—</Text>,
    },
    {
      title: '状态', dataIndex: 'status', width: 80,
      render: (v: number) => (v === 0 ? <Tag color="default">停用</Tag> : <Tag color="success">启用</Tag>),
    },
    { title: '注册时间', dataIndex: 'created_at', width: 150, render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '—') },
    {
      title: '操作', width: 230, render: (_: unknown, r: User) => {
        // 防自锁：当前登录账号自身行禁用角色下拉与停用/启用。
        const isSelf = !!currentUser && r.id === currentUser.id;
        return (
          <Space size={6}>
            <Select
              size="small"
              value={Number(r.role)}
              style={{ width: 100 }}
              disabled={isSelf}
              onChange={(v) => handleRoleChange(r, v)}
              options={[
                { value: ROLE_USER, label: '普通用户' },
                { value: ROLE_ADMIN, label: '管理员' },
                { value: ROLE_ORGANIZER, label: '主办方' },
              ]}
            />
            <Popconfirm
              title={r.status === 1 ? '确认停用该账号？' : '确认启用该账号？'}
              description={r.status === 1 ? '停用后该账号无法登录，已签发 token 立即失效。' : undefined}
              onConfirm={() => handleToggleStatus(r)}
              disabled={isSelf}
            >
              <Button size="small" disabled={isSelf} icon={r.status === 1 ? <StopOutlined /> : <CheckCircleOutlined />}>
                {r.status === 1 ? '停用' : '启用'}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <Card title="用户管理">
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索用户名/昵称/手机"
          style={{ width: 280 }}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={() => fetchData(1, keyword, roleFilter)}
          allowClear
        />
        <Select
          style={{ width: 140 }}
          placeholder="角色筛选"
          value={roleFilter}
          allowClear
          onChange={(v) => { setRoleFilter(v); fetchData(1, keyword, v); }}
          options={[
            { value: ROLE_USER, label: '普通用户' },
            { value: ROLE_ADMIN, label: '管理员' },
            { value: ROLE_ORGANIZER, label: '主办方' },
          ]}
        />
      </Space>
      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ current: page, total, pageSize: PAGE_SIZE, onChange: (p) => fetchData(p, keyword, roleFilter) }}
      />

      <Modal
        title="填写对外展示名"
        open={promoteOpen}
        onCancel={() => { setPromoteOpen(false); setPromoting(null); form.resetFields(); }}
        onOk={submitPromote}
        destroyOnClose
      >
        <Text type="secondary">
          将「{promoting?.username}」升级为主办方前，需先设置对外展示名（将出现在公共主办方列表与场次归属中）。
        </Text>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }} preserve={false}>
          <Form.Item
            name="organizer_name"
            label="对外展示名"
            rules={[{ required: true, message: '请输入对外展示名' }]}
          >
            <Input placeholder="如：某某舞团" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
