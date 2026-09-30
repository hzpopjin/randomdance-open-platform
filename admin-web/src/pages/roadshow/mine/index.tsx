import { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Typography, message, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getMyRegistrations } from '../../../services/registration';
import { REGISTRATION_STATUS_MAP, SONG_FORMAT_MAP } from '../../../config/constants';

const { Title } = Typography;

export default function MyRegistrationsPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const fetchData = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getMyRegistrations({ page: p, page_size: 10 });
      setData(res.data.list); setTotal(res.data.total); setPage(p);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '场次', dataIndex: 'session_name' },
    { title: '表演歌曲', dataIndex: 'song_name' },
    { title: '歌手', dataIndex: 'artist_name' },
    { title: '组合名', dataIndex: 'group_name' },
    { title: '音乐类型', dataIndex: 'song_format', render: (v: number) => SONG_FORMAT_MAP[v] || '-' },
    { title: '成员数', dataIndex: 'member_count', width: 80 },
    { title: '状态', dataIndex: 'status', render: (v: string) => { const c = (REGISTRATION_STATUS_MAP as any)[v]; return <Tag color={c?.color}>{c?.label}</Tag>; } },
    { title: '提交时间', dataIndex: 'created_at', render: (v: string) => v?.slice(0, 16).replace('T', ' ') },
    { title: '操作', width: 150, render: (_: any, r: any) => (
      <Space size={4}>
        <Button size="small" type="link" onClick={() => navigate(`/roadshow/position/${r.id}`)}>选位</Button>
        <Button size="small" type="link" onClick={() => navigate(`/roadshow/media?registration_id=${r.id}`)}>素材</Button>
      </Space>
    ) },
  ];

  return (
    <div className="rd-page-shell" style={{ padding: '32px 0' }}>
      <div className="rd-container">
        <Card className="rd-glass-card" style={{ borderRadius: 24 }} styles={{ body: { padding: 24 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <Title level={4} style={{ margin: 0 }}>我的路演报名</Title>
            <Button type="primary" onClick={() => navigate('/roadshow/create')}>新建报名</Button>
          </div>
          <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
            pagination={{ current: page, total, pageSize: 10, onChange: fetchData }} />
        </Card>
      </div>
    </div>
  );
}
