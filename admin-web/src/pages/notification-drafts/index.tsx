import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Typography } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';
import { canAccessAdmin } from '../../utils/role';
import { buildPreviewValues, createDraftRequestGate, notificationDraftError, validateNotificationDraft } from '../../utils/notificationDrafts';
import { archiveNotificationDraft, createNotificationDraft, getNotificationDrafts, previewNotificationDraft, restoreNotificationDraft, updateNotificationDraft } from '../../services/notification-drafts';
import type { NotificationDraft, NotificationDraftInput, NotificationPreview } from '../../types/notification-draft';

interface Identity { id: number; token: string; role: string | number }
function useRequestBoundary(identity: Identity) {
  const [gate] = useState(createDraftRequestGate);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; gate.invalidate(); };
  }, [gate]);
  const current = useCallback((ticket: number) => {
    const auth = useAuthStore.getState();
    return active.current && gate.current(ticket) && auth.token === identity.token && auth.user?.id === identity.id
      && auth.user?.role === identity.role && canAccessAdmin(auth.user?.role);
  }, [gate, identity.id, identity.token, identity.role]);
  return { gate, current };
}

function DraftEditor({ identity, draft, close, saved, refresh }: {
  identity: Identity; draft: NotificationDraft | null; close: () => void; saved: () => void; refresh: () => void;
}) {
  const [form] = Form.useForm<NotificationDraftInput>();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const { gate, current } = useRequestBoundary(identity);
  const dismiss = () => { gate.invalidate(); close(); };
  const submit = async (values: NotificationDraftInput) => {
    if (pending.current) return;
    const input = { ...values, variables: (values.variables || []).map(v => ({ name: v.name || '', required: !!v.required })) };
    const validation = validateNotificationDraft(input);
    if (validation) { setError(validation); return; }
    pending.current = true;
    setBusy(true); setError('');
    const ticket = gate.next();
    try {
      if (draft) await updateNotificationDraft(draft.id, input, draft.revision);
      else await createNotificationDraft(input);
      if (current(ticket)) saved();
    } catch (err) {
      if (current(ticket)) {
        setError(`${notificationDraftError(err)}。如草稿版本已变化，请关闭并从刷新后的列表重新编辑。`);
        refresh();
      }
    } finally { if (current(ticket)) { pending.current = false; setBusy(false); } }
  };
  return <Modal open title={draft ? '编辑通知草稿' : '新建通知草稿'} onCancel={dismiss} footer={null} width={720}>
    <Alert type="info" showIcon title="仅预览，不会发送" style={{ marginBottom: 16 }} />
    {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
    <Form form={form} layout="vertical" initialValues={draft || { name: '', title: '', body: '', variables: [] }} onFinish={submit} disabled={busy}>
      <Form.Item name="name" label="草稿名称" rules={[{ required: true, whitespace: true }]}><Input maxLength={80} showCount /></Form.Item>
      <Form.Item name="title" label="标题" rules={[{ required: true, whitespace: true }]}><Input maxLength={120} showCount /></Form.Item>
      <Form.Item name="body" label="正文" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={5} maxLength={2000} showCount /></Form.Item>
      <Typography.Paragraph type="secondary">使用 {'{{variable_name}}'} 插入已声明变量。预览时单独填写示例值。</Typography.Paragraph>
      <Form.List name="variables">{(fields, { add, remove }) => <>
        {fields.map(field => <Space key={field.key} align="baseline" wrap>
          <Form.Item name={[field.name, 'name']} label="变量名" rules={[{ required: true, message: '请填写变量名' }]}><Input placeholder="event_name" maxLength={40} /></Form.Item>
          <Form.Item name={[field.name, 'required']} label="必填" valuePropName="checked"><Switch /></Form.Item>
          <Button onClick={() => remove(field.name)}>移除变量</Button>
        </Space>)}
        <Form.Item><Button disabled={busy || fields.length >= 30} icon={<PlusOutlined />} onClick={() => add({ name: '', required: true })}>添加变量</Button></Form.Item>
      </>}</Form.List>
      <Space><Button type="primary" htmlType="submit" loading={busy}>保存草稿</Button><Button disabled={false} onClick={dismiss}>取消</Button></Space>
    </Form>
  </Modal>;
}

function PreviewDialog({ identity, draft, close, refresh }: { identity: Identity; draft: NotificationDraft; close: () => void; refresh: () => void }) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<NotificationPreview | null>(null);
  const { gate, current } = useRequestBoundary(identity);
  const dismiss = () => { gate.invalidate(); close(); };
  const submit = async (values: Record<string, unknown>) => {
    if (pending.current) return;
    const ticket = gate.next();
    pending.current = true; setBusy(true); setError(''); setPreview(null);
    try {
      const response = await previewNotificationDraft(draft.id, draft.revision, buildPreviewValues(draft.variables, values));
      if (current(ticket)) setPreview(response.data);
    } catch (err) {
      if (current(ticket)) {
        setError(`${notificationDraftError(err)}。版本冲突时请关闭预览，从刷新后的列表重新打开。`);
        refresh();
      }
    } finally { if (current(ticket)) { pending.current = false; setBusy(false); } }
  };
  return <Modal open title={`预览：${draft.name}`} onCancel={dismiss} footer={<Button onClick={dismiss}>关闭</Button>} width={680}>
    <Alert type="info" showIcon title="仅预览，不会发送" description={`预览已保存的版本 v${draft.revision}，示例值不会保存到草稿。`} style={{ marginBottom: 16 }} />
    {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 16 }} />}
    <Form layout="vertical" onFinish={submit} disabled={busy} onValuesChange={() => { gate.invalidate(); pending.current = false; setBusy(false); setPreview(null); setError(''); }}>
      {draft.variables.map(variable => <Form.Item key={variable.name} name={variable.name} label={variable.name} rules={[{ required: variable.required, message: '请填写此变量' }]}><Input maxLength={2000} /></Form.Item>)}
      <Form.Item><Button type="primary" htmlType="submit" loading={busy}>生成预览</Button></Form.Item>
    </Form>
    {preview && <Card title="预览结果"><Typography.Title level={4} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.title}</Typography.Title><Typography.Paragraph style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{preview.body}</Typography.Paragraph></Card>}
  </Modal>;
}

function DraftWorkspace({ identity }: { identity: Identity }) {
  // This cache belongs to the keyed identity component and is destroyed on logout/account/role change.
  const [drafts, setDrafts] = useState<NotificationDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const mutationPending = useRef(false);
  const [editor, setEditor] = useState<{ draft: NotificationDraft | null } | null>(null);
  const [preview, setPreview] = useState<NotificationDraft | null>(null);
  const listing = useRequestBoundary(identity);
  const mutation = useRequestBoundary(identity);
  const load = useCallback(async () => {
    const ticket = listing.gate.next();
    setLoading(true); setError('');
    try {
      const response = await getNotificationDrafts();
      if (listing.current(ticket)) setDrafts(response.data);
    } catch (err) { if (listing.current(ticket)) setError(notificationDraftError(err)); }
    finally { if (listing.current(ticket)) setLoading(false); }
  }, [listing.gate, listing.current]);
  useEffect(() => { void load(); }, [load]);
  const changeStatus = async (draft: NotificationDraft) => {
    if (mutationPending.current) return;
    mutationPending.current = true; setBusyId(draft.id); setError('');
    const ticket = mutation.gate.next();
    try {
      const action = draft.status === 'draft' ? archiveNotificationDraft : restoreNotificationDraft;
      await action(draft.id, draft.revision);
      if (mutation.current(ticket)) await load();
    } catch (err) {
      if (mutation.current(ticket)) {
        await load();
        if (mutation.current(ticket)) setError(`${notificationDraftError(err)}。请刷新列表，核对最新状态后重试。`);
      }
    } finally { if (mutation.current(ticket)) { mutationPending.current = false; setBusyId(null); } }
  };
  return <Space orientation="vertical" size="large" style={{ width: '100%' }}>
    <div><Typography.Title level={3}>通知草稿与预览</Typography.Title><Alert type="info" showIcon title="仅预览，不会发送" description="创建和编辑通知内容，使用示例变量检查预览。归档草稿可随时恢复。" /></div>
    <Space wrap><Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor({ draft: null })}>新建草稿</Button><Button icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>刷新</Button></Space>
    {error && <Alert type="error" showIcon title={error} />}
    <Table<NotificationDraft> rowKey="id" dataSource={drafts} loading={loading} scroll={{ x: 850 }} pagination={{ pageSize: 10, showSizeChanger: false }} locale={{ emptyText: '暂无通知草稿' }} columns={[
      { title: '名称', dataIndex: 'name', ellipsis: true },
      { title: '标题', dataIndex: 'title', ellipsis: true },
      { title: '状态', dataIndex: 'status', render: status => <Tag color={status === 'draft' ? 'blue' : 'default'}>{status === 'draft' ? '草稿' : '已归档'}</Tag> },
      { title: '版本', dataIndex: 'revision', width: 75 },
      { title: '更新时间', dataIndex: 'updated_at', width: 190 },
      { title: '操作', width: 240, render: (_, draft) => <Space wrap>
        <Button size="small" disabled={busyId !== null || draft.status === 'archived'} onClick={() => setEditor({ draft })}>编辑</Button>
        <Button size="small" disabled={busyId !== null || draft.status === 'archived'} onClick={() => setPreview(draft)}>预览</Button>
        <Popconfirm title={draft.status === 'draft' ? '归档此草稿？' : '恢复此草稿？'} onConfirm={() => changeStatus(draft)} okText="确认" cancelText="取消" disabled={busyId !== null}>
          <Button size="small" disabled={busyId !== null} loading={busyId === draft.id}>{draft.status === 'draft' ? '归档' : '恢复'}</Button>
        </Popconfirm>
      </Space> },
    ]} />
    {editor && <DraftEditor identity={identity} draft={editor.draft} close={() => setEditor(null)} saved={() => { setEditor(null); void load(); }} refresh={() => void load()} />}
    {preview && <PreviewDialog identity={identity} draft={preview} close={() => setPreview(null)} refresh={() => void load()} />}
  </Space>;
}

export default function NotificationDraftsPage() {
  const { user, token } = useAuthStore();
  if (!user || !token || !canAccessAdmin(user.role)) return null;
  return <DraftWorkspace key={`${user.id}:${user.role}:${token}`} identity={{ id: user.id, role: user.role, token }} />;
}
