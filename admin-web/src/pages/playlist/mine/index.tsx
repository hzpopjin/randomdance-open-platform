import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getMySubmissions } from '../../../services/user-submissions';
import { SUBMISSION_STATUS_MAP } from '../../../config/constants';

const { Title } = Typography;

export default function MySubmissionsPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchData = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getMySubmissions({ page: p, page_size: 10 });
      setData(res.data.list); setTotal(res.data.total); setPage(p);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '场次', dataIndex: 'session_name' },
    { title: '歌曲数', dataIndex: 'song_count', width: 80 },
    { title: '状态', dataIndex: 'status', render: (v: string) => { const c = (SUBMISSION_STATUS_MAP as any)[v]; return <Tag color={c?.color}>{c?.label}</Tag>; } },
    { title: '提交时间', dataIndex: 'created_at', render: (v: string) => v?.slice(0, 16).replace('T', ' ') },
    { title: '操作', width: 80, render: (_: any, r: any) => <Button size="small" onClick={() => navigate(`/playlist/detail/${r.id}`)}>详情</Button> },
  ];

  return (
    <div className="rd-page-shell" style={{ padding: '32px 0' }}>
      <div className="rd-container">
        <Card className="rd-glass-card" style={{ borderRadius: 24 }} styles={{ body: { padding: 24 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>我的投稿</Title>
            <Button type="primary" onClick={() => navigate('/playlist/browse')}>新建投稿</Button>
          </div>
          <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
            pagination={{ current: page, total, pageSize: 10, onChange: fetchData }} />
        </Card>
      </div>
    </div>
  );
}
