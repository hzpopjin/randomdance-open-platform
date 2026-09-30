import { useState, useEffect } from 'react';
import { Card, Table, Tag, Space, Select, Input, Button, message, Drawer, Descriptions, Popconfirm, Modal, Form } from 'antd';
import { EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { getSubmissions, getSubmissionDetail, reviewSubmission, batchReviewSubmissions, deleteSubmission, batchDeleteSubmissions, exportSubmissions } from '../../../services/submissions';
import { getSessions } from '../../../services/sessions';
import { SUBMISSION_STATUS_MAP } from '../../../config/constants';
import ExportButton from '../../../components/common/ExportButton';
import PlayPartTag from '../../../components/common/PlayPartTag';
import dayjs from 'dayjs';

export default function SubmissionListPage() {
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
      const res = await getSubmissions({ page: p, page_size: 10, ...filters });
      setData(res.data.list); setTotal(res.data.total); setPage(p);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchData();
    getSessions({ page: 1, page_size: 100 }).then((res) => setSessions(res.data.list)).catch(() => {});
  }, []);

  const handleView = async (id: number) => {
    try { const res = await getSubmissionDetail(id); setDetail(res.data); setDrawerOpen(true); }
    catch (e: any) { message.error(e.message); }
  };

  const handleReview = async (values: any) => {
    try {
      await batchReviewSubmissions({ ids: reviewModal.ids, status: values.status, review_comment: values.review_comment });
      message.success('审核操作成功');
      setReviewModal({ open: false, ids: [] }); reviewForm.resetFields();
      fetchData(page); setSelectedRowKeys([]);
    } catch (e: any) { message.error(e.message); }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户', dataIndex: 'user_nickname' },
    { title: '场次', dataIndex: 'session_name' },
    { title: '歌曲数', dataIndex: 'song_count', width: 70 },
    { title: '自定义数', dataIndex: 'custom_song_count', width: 80 },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => { const c = (SUBMISSION_STATUS_MAP as any)[v]; return <Tag color={c?.color}>{c?.label}</Tag>; } },
    { title: '提交时间', dataIndex: 'created_at', width: 140, render: (v: string) => v ? dayjs(v).format('MM-DD HH:mm') : '-' },
    { title: '操作', width: 80, render: (_: any, r: any) => <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(r.id)} /> },
  ];

  return (
    <Card title="歌单投稿列表" extra={<ExportButton sessions={sessions} onExport={(sid) => exportSubmissions({ session_id: sid }).then((res: any) => res.data || res)} defaultSessionId={filters.session_id} />}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select placeholder="场次" allowClear style={{ width: 180 }} value={filters.session_id} onChange={(v) => setFilters({ ...filters, session_id: v })} options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
        <Select placeholder="状态" allowClear style={{ width: 120 }} value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })} options={[{ value: 'pending', label: '待审核' }, { value: 'approved', label: '已收录' }, { value: 'rejected', label: '已拒绝' }]} />
        <Input.Search placeholder="搜索用户" style={{ width: 200 }} value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} onSearch={() => fetchData(1)} allowClear />
        <Button onClick={() => fetchData(1)}>查询</Button>
      </Space>
      {selectedRowKeys.length > 0 && (
        <Space style={{ marginBottom: 16 }}>
          <span>已选 {selectedRowKeys.length} 项</span>
          <Button size="small" type="primary" onClick={() => setReviewModal({ open: true, ids: selectedRowKeys })}>批量审核</Button>
          <Popconfirm title="确认删除选中项？" onConfirm={() => batchDeleteSubmissions(selectedRowKeys).then(() => { message.success('删除成功'); setSelectedRowKeys([]); fetchData(page); })}>
            <Button size="small" danger icon={<DeleteOutlined />}>批量删除</Button>
          </Popconfirm>
        </Space>
      )}
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as number[]) }}
        pagination={{ current: page, total, pageSize: 10, onChange: fetchData }} />
      <Drawer title="投稿详情" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={600}>
        {detail && (
          <>
            <Descriptions column={1} bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
              <Descriptions.Item label="用户">{detail.user_nickname} ({detail.username})</Descriptions.Item>
              <Descriptions.Item label="手机">{detail.user_phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="场次">{detail.session_name}</Descriptions.Item>
              <Descriptions.Item label="状态">{(() => { const c = (SUBMISSION_STATUS_MAP as any)[detail.status]; return <Tag color={c?.color}>{c?.label}</Tag>; })()}</Descriptions.Item>
              {detail.review_comment && <Descriptions.Item label="审核备注">{detail.review_comment}</Descriptions.Item>}
              <Descriptions.Item label="提交时间">{detail.created_at?.slice(0, 19).replace('T', ' ')}</Descriptions.Item>
            </Descriptions>
            <Card title="歌曲列表" size="small">
              <Table dataSource={detail.songs || []} rowKey="id" pagination={false} size="small"
                columns={[
                  { title: '歌曲名', dataIndex: 'song_name' },
                  { title: '歌手', dataIndex: 'artist_name' },
                  { title: '段落', dataIndex: 'play_part', render: (v: number) => <PlayPartTag playPart={v} /> },
                  { title: '参考链接', dataIndex: 'reference_url', render: (v: string) => v ? <a href={v} target="_blank" rel="noreferrer">查看</a> : '-' },
                ]} />
            </Card>
          </>
        )}
      </Drawer>
      <Modal title="批量审核" open={reviewModal.open} onCancel={() => setReviewModal({ open: false, ids: [] })} onOk={() => reviewForm.submit()} destroyOnClose>
        <Form form={reviewForm} layout="vertical" onFinish={handleReview}>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={[{ value: 'pending', label: '待审核' }, { value: 'approved', label: '已收录' }, { value: 'rejected', label: '已拒绝' }]} />
          </Form.Item>
          <Form.Item name="review_comment" label="审核备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
