import { useState, useEffect } from 'react';
import { Card, Table, Select, Typography, Row, Col, Statistic, message } from 'antd';
import { getSubmissionStatistics } from '../../../services/submissions';
import { getSessions } from '../../../services/sessions';

const { Title } = Typography;

export default function SubmissionStatisticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<number>();

  useEffect(() => {
    getSessions({ page: 1, page_size: 100 }).then((res) => setSessions(res.data.list)).catch(() => {});
    getSubmissionStatistics().then((res) => setStats(res.data)).catch((e) => message.error(e.message));
  }, []);

  const handleSessionChange = (v?: number) => {
    setSessionId(v);
    getSubmissionStatistics({ session_id: v }).then((res) => setStats(res.data)).catch((e) => message.error(e.message));
  };

  const songColumns = [
    { title: '歌曲名', dataIndex: 'song_name' },
    { title: '歌手', dataIndex: 'artist_name' },
    { title: '投稿次数', dataIndex: 'count', width: 100 },
  ];

  return (
    <Card title="投稿统计" extra={<Select placeholder="选择场次" allowClear style={{ width: 200 }} value={sessionId} onChange={handleSessionChange} options={sessions.map((s) => ({ value: s.id, label: s.name }))} />}>
      {stats && (
        <>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={6}><Statistic title="总投稿数" value={stats.total_submissions} /></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Title level={5}>热门歌曲</Title>
              <Table columns={songColumns} dataSource={stats.hot_songs} rowKey={(r: any) => `${r.artist_name}-${r.song_name}`} pagination={{ pageSize: 10 }} size="small" />
            </Col>
            <Col xs={24} md={12}>
              <Title level={5}>自定义歌曲</Title>
              <Table columns={songColumns} dataSource={stats.custom_songs} rowKey={(r: any) => `${r.artist_name}-${r.song_name}`} pagination={{ pageSize: 10 }} size="small" />
            </Col>
          </Row>
        </>
      )}
    </Card>
  );
}
