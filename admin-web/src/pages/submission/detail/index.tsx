import { useState, useEffect } from 'react';
import { Card, Descriptions, Tag, Table, Button, Typography, Spin, message, Space, Modal, Form, Input, Select } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getSubmissionDetail, reviewSubmission } from '../../../services/submissions';
import { SUBMISSION_STATUS_MAP } from '../../../config/constants';
import PlayPartTag from '../../../components/common/PlayPartTag';
import dayjs from 'dayjs';

const { Title } = Typography;

export default function SubmissionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviewModal, setReviewModal] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (!id) return;
    getSubmissionDetail(+id).then((res) => setData(res.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  if (!data) return null;

  const statusConfig = (SUBMISSION_STATUS_MAP as any)[data.status];

  const handleReview = async (values: any) => {
    try {
      await reviewSubmission(+id!, values);
      message.success('审核操作成功');
      setReviewModal(false); form.resetFields();
      const res = await getSubmissionDetail(+id!); setData(res.data);
    } catch (e: any) { message.error(e.message); }
  };

  return (
    <Card title={<Space><Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/admin/submissions/list')} />投稿详情 #{data.id}</Space>}
      extra={<Button type="primary" onClick={() => setReviewModal(true)}>审核</Button>}>
      <Descriptions column={2} bordered style={{ marginBottom: 24 }}>
        <Descriptions.Item label="用户">{data.user_nickname} ({data.username})</Descriptions.Item>
        <Descriptions.Item label="手机">{data.user_phone || '-'}</Descriptions.Item>
        <Descriptions.Item label="场次">{data.session_name}</Descriptions.Item>
        <Descriptions.Item label="状态"><Tag color={statusConfig?.color}>{statusConfig?.label}</Tag></Descriptions.Item>
        <Descriptions.Item label="歌曲数">{data.songs?.length || 0}</Descriptions.Item>
        <Descriptions.Item label="提交时间">{dayjs(data.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
        {data.review_comment && <Descriptions.Item label="审核备注" span={2}>{data.review_comment}</Descriptions.Item>}
      </Descriptions>
      <Title level={5}>歌曲列表</Title>
      <Table dataSource={data.songs || []} rowKey="id" pagination={false} size="small"
        columns={[
          { title: '歌曲名', dataIndex: 'song_name' },
          { title: '歌手', dataIndex: 'artist_name' },
          { title: '段落', dataIndex: 'play_part', render: (v: number) => <PlayPartTag playPart={v} /> },
          { title: '参考链接', dataIndex: 'reference_url', render: (v: string) => v ? <a href={v} target="_blank" rel="noreferrer">查看</a> : '-' },
        ]} />
      <Modal title="审核投稿" open={reviewModal} onCancel={() => setReviewModal(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={handleReview}>
          <Form.Item name="status" label="状态" rules={[{ required: true }]}>
            <Select options={[{ value: 'pending', label: '待审核' }, { value: 'approved', label: '已收录' }, { value: 'rejected', label: '已拒绝' }]} />
          </Form.Item>
          <Form.Item name="review_comment" label="审核备注"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
