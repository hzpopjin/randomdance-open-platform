import { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space, Select, Input, message, Drawer, Descriptions, Popconfirm, Modal, Form } from 'antd';
import { ExportOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { getRegistrations, getRegistrationDetail, reviewRegistration, batchReviewRegistrations, deleteRegistration, batchDeleteRegistrations, exportRegistrations } from '../../services/roadshow';
import { getSessions } from '../../services/sessions';
import { REGISTRATION_STATUS_MAP, SONG_FORMAT_MAP } from '../../config/constants';
import ExportButton from '../../components/common/ExportButton';
import dayjs from 'dayjs';

export default function RoadshowListPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [filters, setFilters] = useState<any>({ status: undefined, session_id: undefined, keyword: '' });
  const [detail, setDetail] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [reviewModal, setReviewModal] = useState<{ open: boolean; ids: number[] }>({ open: false, ids: [] });
  const [reviewForm] = Form.useForm();

  const fetchData = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getRegistrations({ page: p, page_size: 10, ...filters });
      setData(res.data.list); setTotal(res.data.total); setPage(p);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    getSessions({ page: 1, page_size: 100 }).then((res) => setSessions(res.data.list)).catch(() => {});
  }, []);

  const handleView = async (id: number) => {
    try {
      const res = await getRegistrationDetail(id);
      setDetail(res.data); setDrawerOpen(true);
    } catch (e: any) { message.error(e.message); }
  };

  const handleReview = async (values: any) => {
    try {
      await batchReviewRegistrations({ ids: reviewModal.ids, status: values.status, review_comment: values.review_comment });
      message.success('审核操作成功');
      setReviewModal({ open: false, ids: [] });
      reviewForm.resetFields();
      fetchData(page);
      setSelectedRowKeys([]);
    } catch (e: any) { message.error(e.message); }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '场次', dataIndex: 'session_name' },
    { title: '表演歌曲', dataIndex: 'song_name' },
    { title: '歌手', dataIndex: 'artist_name' },
    { title: '组合名', dataIndex: 'group_name' },
    { title: '音乐类型', dataIndex: 'song_format', width: 90, render: (v: number) => SONG_FORMAT_MAP[v] || '-' },
    { title: '联系方式', dataIndex: 'contact_phone', width: 120 },
    { title: '成员数', dataIndex: 'member_count', width: 70 },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => { const c = (REGISTRATION_STATUS_MAP as any)[v]; return <Tag color={c?.color}>{c?.label}</Tag>; } },
    { title: '提交时间', dataIndex: 'created_at', width: 140, render: (v: string) => v ? dayjs(v).format('MM-DD HH:mm') : '-' },
    { title: '操作', width: 80, render: (_: any, r: any) => <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(r.id)} /> },
  ];

  return (
    <Card title="路演报名管理" extra={<ExportButton sessions={sessions} onExport={(sid, status) => exportRegistrations({ session_id: sid, status }).then((res: any) => res.data || res)} defaultSessionId={filters.session_id} hasStatus />}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select placeholder="场次" allowClear style={{ width: 180 }} value={filters.session_id} onChange={(v) => setFilters({ ...filters, session_id: v })}
          options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
        <Select placeholder="状态" allowClear style={{ width: 120 }} value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })}
          options={[{ value: 'pending', label: '待审核' }, { value: 'approved', label: '已通过' }, { value: 'rejected', label: '已驳回' }]} />
        <Input.Search placeholder="搜索组合名/歌曲/手机号" style={{ width: 220 }} value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} onSearch={() => fetchData(1)} allowClear />
        <Button onClick={() => fetchData(1)}>查询</Button>
      </Space>
      {selectedRowKeys.length > 0 && (
        <Space style={{ marginBottom: 16 }}>
          <span>已选 {selectedRowKeys.length} 项</span>
          <Button size="small" type="primary" onClick={() => setReviewModal({ open: true, ids: selectedRowKeys })}>批量审核</Button>
          <Popconfirm title="确认删除选中项？" onConfirm={() => batchDeleteRegistrations(selectedRowKeys).then(() => { message.success('删除成功'); setSelectedRowKeys([]); fetchData(page); })}>
            <Button size="small" danger icon={<DeleteOutlined />}>批量删除</Button>
          </Popconfirm>
        </Space>
      )}
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as number[]) }}
        pagination={{ current: page, total, pageSize: 10, onChange: fetchData }} />
      <Drawer title="报名详情" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={500}>
        {detail && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
            <Descriptions.Item label="用户">{detail.user_nickname} ({detail.username})</Descriptions.Item>
            <Descriptions.Item label="场次">{detail.session_name}</Descriptions.Item>
            <Descriptions.Item label="表演歌曲">{detail.song_name}</Descriptions.Item>
            <Descriptions.Item label="歌手">{detail.artist_name}</Descriptions.Item>
            <Descriptions.Item label="组合名">{detail.group_name}</Descriptions.Item>
            <Descriptions.Item label="音乐类型">{SONG_FORMAT_MAP[detail.song_format]}</Descriptions.Item>
            {(detail.audio_access_url || detail.edited_file_url) && <Descriptions.Item label="剪辑链接·查看"><a href={detail.audio_access_url || detail.edited_file_url} target="_blank" rel="noreferrer">查看</a></Descriptions.Item>}
            {(detail.review_video_access_url || detail.review_video_url) && (
              <Descriptions.Item label="审核视频">
                <a href={detail.review_video_access_url || detail.review_video_url} target="_blank" rel="noreferrer">查看</a>
                {detail.review_video_url && (
                  <div style={{ fontSize: 12, color: '#8c98a8', wordBreak: 'break-all', marginTop: 2 }}>{detail.review_video_url}</div>
                )}
              </Descriptions.Item>
            )}
            <Descriptions.Item label="联系方式">{detail.contact_phone}</Descriptions.Item>
            <Descriptions.Item label="成员">{detail.members?.map((m: any) => `${m.member_name}(${m.position || '-'})`).join(', ') || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">{(() => { const c = (REGISTRATION_STATUS_MAP as any)[detail.status]; return <Tag color={c?.color}>{c?.label}</Tag>; })()}</Descriptions.Item>
            {detail.review_comment && <Descriptions.Item label="审核备注">{detail.review_comment}</Descriptions.Item>}
            <Descriptions.Item label="提交时间">{detail.created_at?.slice(0, 19).replace('T', ' ')}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
      <Modal title="批量审核" open={reviewModal.open} onCancel={() => setReviewModal({ open: false, ids: [] })} onOk={() => reviewForm.submit()} destroyOnClose>
        <Form form={reviewForm} layout="vertical" onFinish={handleReview}>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={[{ value: 'pending', label: '待审核' }, { value: 'approved', label: '已通过' }, { value: 'rejected', label: '已驳回' }]} />
          </Form.Item>
          <Form.Item name="review_comment" label="审核备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
