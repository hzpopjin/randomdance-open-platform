import { Button, Card, Row, Col, Typography, Space, Alert } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRightOutlined, CheckCircleOutlined, CustomerServiceOutlined,
  FormOutlined, LoginOutlined, PlayCircleOutlined,
  SafetyCertificateOutlined, UserOutlined, CrownOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';

const { Title, Text, Paragraph } = Typography;

export default function HomePage() {
  const navigate = useNavigate();
  const { isGuest, token, user } = useAuthStore();

  const quickActions = [
    { title: '路演报名', desc: '提交表演曲目、成员与联系方式', icon: <FormOutlined />, color: '#007aff', path: '/roadshow/create', button: '立即报名', primary: true },
    { title: '随舞歌单投稿', desc: '从曲库选择歌曲，也可添加自定义歌曲', icon: <PlayCircleOutlined />, color: '#31c48d', path: '/playlist/browse', button: '开始投稿', primary: true },
    { title: '我的报名', desc: '查看路演报名记录与审核状态', icon: <UserOutlined />, color: '#007aff', path: '/roadshow/mine', button: '查看记录' },
    { title: '我的投稿', desc: '查看随舞歌单投稿记录', icon: <CustomerServiceOutlined />, color: '#007aff', path: '/playlist/mine', button: '查看记录' },
  ];

  const workflow = token && !isGuest
    ? ['登录平台账号', '选择路演报名或歌单投稿', '在线跟踪审核状态']
    : ['直接开始报名或投稿（游客模式）', '随时登录或注册保留正式账号', '同浏览器内可查看投稿记录'];

  return (
    <div className="rd-page-shell">
      <section className="rd-home-hero">
        <div className="rd-container">
          <Row gutter={[40, 32]} align="middle">
            <Col xs={24} lg={14}>
              <div className="rd-pill" style={{ marginBottom: 22 }}>
                <SafetyCertificateOutlined /> 开放平台报名与投稿入口
              </div>
              <Title className="rd-home-title">随机舞蹈中文站<br /><span style={{ color: '#007aff' }}>开放平台</span></Title>
              <Paragraph className="rd-home-subtitle">
                用于路演报名、随机舞蹈歌单投稿，以及个人业务记录查询。支持游客直接投稿，登录后可跨设备同步记录。
              </Paragraph>
              <Space size={12} wrap>
                <Button type="primary" size="large" icon={<FormOutlined />} onClick={() => navigate('/roadshow/create')}>路演报名</Button>
                <Button size="large" icon={<PlayCircleOutlined />} onClick={() => navigate('/playlist/browse')}>随舞歌单投稿</Button>
              </Space>
            </Col>
            <Col xs={24} lg={10}>
              <Card className="rd-glass-card" style={{ borderRadius: 28 }} styles={{ body: { padding: 28 } }}>
                <div className="rd-hero-panel">
                  <div className="rd-brand-mark rd-hero-mark">RD</div>
                  <div>
                    <Text style={{ color: 'rgba(255,255,255,0.78)' }}>Random Dance China Open Platform</Text>
                    <Title level={2} style={{ color: '#fff', margin: '8px 0 0' }}>报名、投稿与审核</Title>
                  </div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {workflow.map((item) => (
                      <div key={item} className="rd-hero-step"><CheckCircleOutlined /> {item}</div>
                    ))}
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>
      </section>
      {isGuest && (
        <div className="rd-container" style={{ paddingTop: 20 }}>
          <Alert
            type="info"
            showIcon
            icon={<CrownOutlined />}
            message="你正在使用游客模式"
            description="你的报名和投稿记录保存在当前浏览器中。登录或注册正式账号后，可在不同设备查看记录并获得更好的体验。"
            action={<Button size="small" type="primary" onClick={() => navigate('/login')}>登录 / 注册</Button>}
          />
        </div>
      )}
      <section className="rd-home-actions-section">
        <div className="rd-container">
          <div className="rd-section-heading">
            <div>
              <Title level={3} style={{ margin: 0 }}>选择你要办理的事项</Title>
              <Text type="secondary">所有入口均连接当前线上业务流程</Text>
            </div>
          </div>
          <Row gutter={[18, 18]}>
            {quickActions.map((action) => (
              <Col xs={24} md={action.primary ? 24 : 12} lg={action.primary ? 8 : 12} key={action.title}>
                <Card className="rd-card-hover" style={{ borderRadius: 20, height: '100%' }} styles={{ body: { padding: 24 } }}>
                  <div className="rd-action-card-inner">
                    <div className="rd-icon-bubble" style={{ background: `linear-gradient(135deg, ${action.color}22, ${action.color}11)`, color: action.color }}>{action.icon}</div>
                    <div className="rd-action-card-copy">
                      <Title level={5} style={{ margin: '0 0 4px' }}>{action.title}</Title>
                      <Text type="secondary">{action.desc}</Text>
                    </div>
                    <Button type={action.primary ? 'primary' : 'default'} onClick={() => navigate(action.path)}>
                      {action.button} <ArrowRightOutlined />
                    </Button>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        </div>
      </section>
    </div>
  );
}
