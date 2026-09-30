import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, Select, message, Space, Tag, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getSongs, createSong, updateSong, deleteSong, updateSongStatus } from '../../../services/songs';

export default function SongListPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchData = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getSongs({ page: p, page_size: 10, keyword });
      setData(res.data.list); setTotal(res.data.total); setPage(p);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editing) await updateSong(editing.id, values);
      else await createSong({ ...values, status: 1 });
      message.success(editing ? '更新成功' : '创建成功');
      setModalOpen(false); form.resetFields(); setEditing(null);
      fetchData(page);
    } catch (e: any) { message.error(e.message); }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '歌曲名', dataIndex: 'song_name' },
    { title: '歌手', dataIndex: 'artist_name' },
    { title: '次要歌名', dataIndex: 'alt_title' },
    { title: '备注', dataIndex: 'remark' },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: number) => v === 1 ? <Tag color="green">启用</Tag> : <Tag color="orange">待审核</Tag> },
    { title: '操作', width: 160, render: (_: any, r: any) => (
      <Space>
        <Button size="small" icon={<EditOutlined />} onClick={() => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); }} />
        <Button size="small" onClick={() => updateSongStatus(r.id, r.status === 1 ? 0 : 1).then(() => fetchData(page))}>{r.status === 1 ? '禁用' : '启用'}</Button>
        <Popconfirm title="确认删除？" onConfirm={() => deleteSong(r.id).then(() => fetchData(page))}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <Card title="歌曲库" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditing(null); form.resetFields(); setModalOpen(true); }}>添加歌曲</Button>}>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search placeholder="搜索歌曲名/歌手" style={{ width: 240 }} value={keyword} onChange={(e) => setKeyword(e.target.value)} onSearch={() => fetchData(1)} allowClear />
      </Space>
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, total, pageSize: 10, onChange: fetchData }} />
      <Modal title={editing ? '编辑歌曲' : '添加歌曲'} open={modalOpen} onCancel={() => { setModalOpen(false); setEditing(null); }} onOk={handleSave}>
        <Form form={form} layout="vertical">
          <Form.Item name="song_name" label="歌曲名" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="artist_name" label="歌手" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="alt_title" label="次要歌名"><Input /></Form.Item>
          <Form.Item name="remark" label="备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
