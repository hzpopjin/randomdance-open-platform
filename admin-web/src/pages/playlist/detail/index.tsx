import { useState, useEffect } from 'react';
import { Card, Descriptions, Tag, Button, Table, Typography, message, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { getSubmissionDetail } from '../../../services/user-submissions';
import { SUBMISSION_STATUS_MAP, PLAY_PART_MAP } from '../../../config/constants';
import PlayPartTag from '../../../components/common/PlayPartTag';

const { Title } = Typography;

export default function SubmissionUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getSubmissionDetail(+id).then((res) => setData(res.data)).catch((e) => message.error(e.message)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  if (!data) return null;

  const statusConfig = (SUBMISSION_STATUS_MAP as any)[data.status];

  const columns = [
    { title: '歌曲名', dataIndex: 'song_name' },
    { title: '歌手', dataIndex: 'artist_name' },
    { title: '播放段落', dataIndex: 'play_part', render: (v: number) => <PlayPartTag playPart={v} /> },
    { title: '参考链接', dataIndex: 'reference_url', render: (v: string) => v ? <a href={v} target="_blank" rel="noreferrer">查看</a> : '-' },
  ];

  return (
    <div className="rd-page-shell" style={{ padding: '32px 0' }}>
      <div className="rd-container">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/playlist/mine')} style={{ marginBottom: 16 }}>返回列表</Button>
        <Card className="rd-glass-card" style={{ borderRadius: 24 }} styles={{ body: { padding: 24 } }}>
          <Title level={4}>投稿详情 #{data.id}</Title>
          <Descriptions column={2} style={{ marginBottom: 24 }}>
            <Descriptions.Item label="场次">{data.session_name}</Descriptions.Item>
            <Descriptions.Item label="状态"><Tag color={statusConfig?.color}>{statusConfig?.label}</Tag></Descriptions.Item>
            <Descriptions.Item label="歌曲数">{data.songs?.length || 0}</Descriptions.Item>
            <Descriptions.Item label="提交时间">{data.created_at?.slice(0, 19).replace('T', ' ')}</Descriptions.Item>
            {data.review_comment && <Descriptions.Item label="审核备注" span={2}>{data.review_comment}</Descriptions.Item>}
          </Descriptions>
          <Table columns={columns} dataSource={data.songs || []} rowKey="id" pagination={false} size="small" />
        </Card>
      </div>
    </div>
  );
}
