import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Typography, Spin, Empty } from 'antd';
import { UserOutlined, CalendarOutlined, FileTextOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { getDashboardStats, type DashboardStats } from '../../services/dashboard';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats().then((res) => setStats(res.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" /></div>;
  if (!stats) return <Empty />;

  const activityColumns = [
    { title: '类型', dataIndex: 'type', width: 80, render: (v: string) => v === 'registration' ? <Tag color="blue">报名</Tag> : <Tag color="green">投稿</Tag> },
    { title: '标题', dataIndex: 'title' },
    { title: '描述', dataIndex: 'description' },
    { title: '状态', dataIndex: 'status', width: 80, render: (v: string) => { const map: any = { pending: { color: 'orange', label: '待审核' }, approved: { color: 'green', label: '已通过' }, rejected: { color: 'red', label: '已拒绝' } }; const c = map[v]; return c ? <Tag color={c.color}>{c.label}</Tag> : v; } },
    { title: '时间', dataIndex: 'created_at', width: 140, render: (v: string) => v ? dayjs(v).format('MM-DD HH:mm') : '-' },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card><Statistic title="总用户" value={stats.summary.total_users} prefix={<UserOutlined />} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="活动场次" value={stats.summary.active_sessions} prefix={<CalendarOutlined />} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="路演报名" value={stats.summary.total_registrations} prefix={<FileTextOutlined />} /></Card></Col>
        <Col xs={12} md={6}><Card><Statistic title="歌单投稿" value={stats.summary.total_submissions} prefix={<PlayCircleOutlined />} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={8}><Card><Statistic title="待审核报名" value={stats.pending.registrations} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title="待审核投稿" value={stats.pending.submissions} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
        <Col xs={12} md={8}><Card><Statistic title="待审核歌曲" value={stats.pending.songs} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="最近活动" style={{ marginBottom: 16 }}>
            <Table columns={activityColumns} dataSource={stats.recent_activity} rowKey="id" pagination={false} size="small" />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="系统健康" style={{ marginBottom: 16 }}>
            <Statistic title="24h 请求数" value={stats.system_health.requests_24h} />
            <Statistic title="24h 错误数" value={stats.system_health.errors_24h} style={{ marginTop: 16 }} valueStyle={{ color: stats.system_health.errors_24h > 0 ? '#ff4d4f' : undefined }} />
            <Statistic title="错误率" value={stats.system_health.error_rate} suffix="%" style={{ marginTop: 16 }} />
            <Statistic title="24h 客户端事件" value={stats.system_health.client_events_24h} style={{ marginTop: 16 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
