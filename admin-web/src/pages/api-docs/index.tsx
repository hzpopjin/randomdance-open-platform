import { useState } from 'react';
import { Alert, Card, Tabs, Table, Tag, Typography, Input, Space, Collapse } from 'antd';
import { CodeOutlined, SearchOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph, Link } = Typography;

interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  auth: string;
  params?: string;
  body?: string;
  response?: string;
}

interface ApiGroup {
  key: string;
  label: string;
  endpoints: ApiEndpoint[];
}

const apiGroups: ApiGroup[] = [
  {
    key: 'auth',
    label: '认证模块',
    endpoints: [
      { method: 'POST', path: '/auth/register', description: '注册新用户', auth: '无', body: '{ username: string, password: string, nickname?: string, phone?: string, email?: string }', response: '{ token: string, user: { id, username, nickname, role, ... } }' },
      { method: 'POST', path: '/auth/login', description: '用户名密码登录', auth: '无', body: '{ username: string, password: string }', response: '{ token: string, user: { id, username, nickname, role, ... } }' },
      { method: 'GET', path: '/auth/profile', description: '获取当前用户信息', auth: 'JWT', response: '{ id, username, nickname, phone, email, role, avatar_url, created_at, updated_at }' },
      { method: 'PATCH', path: '/auth/profile', description: '更新个人信息', auth: 'JWT', body: '{ nickname?: string, phone?: string, email?: string, password?: string }', response: '更新后的用户信息' },
      { method: 'POST', path: '/admin/login', description: '管理员登录（同 /auth/login）', auth: '无', body: '{ username: string, password: string }', response: '{ token: string, user: {...} }' },
      { method: 'GET', path: '/admin/profile', description: '获取管理员信息', auth: '管理员 JWT', response: '管理员用户信息' },
      { method: 'PATCH', path: '/admin/profile', description: '更新管理员信息', auth: '管理员 JWT', body: '{ nickname?, phone?, email?, password? }', response: '更新后的管理员信息' },
      { method: 'POST', path: '/admin/logout', description: '退出登录', auth: '无', response: 'null' },
    ],
  },
  {
    key: 'sessions',
    label: '场次管理',
    endpoints: [
      { method: 'GET', path: '/sessions', description: '公开场次列表', auth: '无', params: 'organizer_id?（按主办方过滤）', response: '{ list: Session[]（每行含 organizer_id、organizer_name）, total: number }' },
      { method: 'GET', path: '/sessions/:id', description: '场次详情', auth: '无', params: 'id: 场次ID', response: 'Session 对象' },
      { method: 'GET', path: '/admin/sessions', description: '场次管理列表（含报名/投稿数）', auth: '管理员', params: 'page, page_size', response: '{ list, total, page, page_size }' },
      { method: 'POST', path: '/admin/sessions', description: '创建场次', auth: '管理员', body: '{ name, event_date, location, registration_start?, registration_end?, venue_info?, roadshow_selection_enabled?, roadshow_selection_open_at?, roadshow_slot_minutes?, roadshow_halftime_delay_minutes? }', response: 'Session 对象' },
      { method: 'PUT', path: '/admin/sessions/:id', description: '更新场次', auth: '管理员', body: 'Partial<Session>', response: 'Session 对象' },
      { method: 'PUT', path: '/admin/sessions/:id/cancel', description: '取消场次', auth: '管理员', response: 'Session 对象' },
      { method: 'PUT', path: '/admin/sessions/:id/restore', description: '恢复场次', auth: '管理员', response: 'Session 对象' },
      { method: 'DELETE', path: '/admin/sessions/:id', description: '删除场次（无关联数据时）', auth: '管理员', response: '{ id, name }' },
    ],
  },
  {
    key: 'roadshow',
    label: '路演报名',
    endpoints: [
      { method: 'POST', path: '/roadshow/registrations', description: '提交路演报名', auth: 'JWT', body: '{ session_id, song_name, artist_name, group_name, song_format(0|1), edited_file_url?, contact_phone, members[], has_other_performance(0|1), other_performance_detail?, additional_requirements?, device_info? }', response: '{ id: number }' },
      { method: 'GET', path: '/roadshow/registrations/mine', description: '我的报名列表', auth: 'JWT', params: 'page, page_size', response: '{ list: Registration[], total, page, page_size }' },
      { method: 'GET', path: '/roadshow/registrations/:id', description: '报名详情', auth: 'JWT', params: 'id', response: 'RegistrationDetail' },
      { method: 'GET', path: '/admin/roadshow/registrations', description: '报名管理列表', auth: '管理员', params: 'page, page_size, status, session_id, keyword, sort_by, sort_order', response: '{ list, total, page, page_size }' },
      { method: 'GET', path: '/admin/roadshow/registrations/:id', description: '报名管理详情', auth: '管理员', response: 'RegistrationDetail（含成员列表）' },
      { method: 'PUT', path: '/admin/roadshow/registrations/:id/status', description: '审核报名', auth: '管理员', body: '{ status: "pending"|"approved"|"rejected", review_comment? }', response: '{ id, status, review_comment }' },
      { method: 'POST', path: '/admin/roadshow/registrations/batch', description: '批量审核', auth: '管理员', body: '{ ids: number[], status, review_comment? }', response: '{ affected: number }' },
      { method: 'PUT', path: '/admin/roadshow/registrations/:id', description: '更新报名信息', auth: '管理员', body: 'Partial<Registration>', response: '{ id }' },
      { method: 'DELETE', path: '/admin/roadshow/registrations/:id', description: '删除报名', auth: '管理员', response: '{ id }' },
      { method: 'DELETE', path: '/admin/roadshow/registrations/batch', description: '批量删除', auth: '管理员', body: '{ ids: number[] }', response: '{ affected: number }' },
      { method: 'GET', path: '/admin/roadshow/registrations/export', description: '导出 Excel', auth: '管理员', params: 'session_id（必填）, status?', response: 'Excel 文件下载' },
    ],
  },
  {
    key: 'roadshow-ops',
    label: '路演选位 / 编排 / 媒体',
    endpoints: [
      { method: 'GET', path: '/roadshow/registrations/:id/positions', description: '获取选位看板（用户端）', auth: 'JWT', response: 'RoadshowPositionBoard' },
      { method: 'PUT', path: '/roadshow/registrations/:id/position', description: '用户选位', auth: 'JWT', body: '{ section: "regular"|"halftime", position_no: number }', response: '选位结果' },
      { method: 'DELETE', path: '/roadshow/registrations/:id/position', description: '用户取消选位', auth: 'JWT', response: 'null' },
      { method: 'GET', path: '/roadshow/registrations/:id/media', description: '查询音频与审核视频素材状态', auth: 'JWT', response: '{ registration_id, video_upload_enabled: boolean, audio: MediaSlot, review_video: MediaSlot }' },
      { method: 'POST', path: '/roadshow/registrations/:id/media/:type/upload-url', description: '申请上传票据（type=audio|review-video；对象存储未启用时 review-video 返回 403「对象存储未启用，暂不支持上传审核视频」，audio 不受影响）', auth: 'JWT', body: '{ file_name, content_type, file_size }', response: "TOS 启用: { mode:'direct', method:'PUT', upload_url, object_key, headers, expires_in, max_size }；未启用: { mode:'local', max_size }" },
      { method: 'POST', path: '/roadshow/registrations/:id/media/:type/complete', description: '直传完成回调（仅 direct 模式；对象存储未启用时 review-video 返回 403）', auth: 'JWT', body: '{ object_key: string }', response: 'MediaState' },
      { method: 'POST', path: '/roadshow/registrations/:id/media/:type', description: '本地回退上传（仅 TOS 未启用；review-video 恒被 403 拦截「对象存储未启用，暂不支持上传审核视频」）', auth: 'JWT', body: 'multipart/form-data: file', response: 'MediaState' },
      { method: 'GET', path: '/admin/roadshow/registrations/arrangement/:sessionId', description: '获取编排视图', auth: '管理员', response: 'RoadshowArrangement' },
      { method: 'PUT', path: '/admin/roadshow/registrations/arrangement/:sessionId', description: '保存编排（乐观锁 expected_version）', auth: '管理员', body: '{ expected_version?, items: [{ registration_id, section, position_no, locked }] }', response: 'RoadshowArrangement' },
      { method: 'POST', path: '/admin/roadshow/registrations/media-download-manifest', description: '批量媒体下载清单', auth: '管理员', body: "{ ids: number[], media_types?: ('audio'|'review-video')[] }", response: '{ items: [{ registration_id, media_type, group_order, filename, download_url }], unavailable: [...] }' },
    ],
  },
  {
    key: 'object-storage',
    label: '对象存储配置',
    endpoints: [
      { method: 'GET', path: '/admin/object-storage', description: '获取对象存储配置', auth: '管理员', response: '{ enabled, accessKeyId, hasAccessKeySecret, secretUnreadable, region, endpoint, bucket, ... }' },
      { method: 'PUT', path: '/admin/object-storage', description: '更新对象存储配置', auth: '管理员', body: '{ enabled, accessKeyId, accessKeySecret?, region, endpoint, bucket, publicBaseUrl?, keyPrefix, roadshowMediaNameTemplate? }', response: '更新后的配置' },
      { method: 'POST', path: '/admin/object-storage/test', description: '测试 Bucket 连接（使用已保存配置）', auth: '管理员', response: '{ ok, bucket, region, requestId }' },
      { method: 'GET', path: '/admin/object-storage/access', description: '获取私有对象签名读取地址', auth: '管理员', params: 'url', response: '{ accessUrl, availability }' },
    ],
  },
  {
    key: 'submissions',
    label: '歌单投稿',
    endpoints: [
      { method: 'POST', path: '/submissions', description: '提交歌单投稿', auth: 'JWT', body: '{ session_id, songs: [{ song_id?, song_name, artist_name, alt_title?, full_title?, file_extension?, full_file_path?, chorus_file_path?, reference_url?, play_part(0|1|2), custom_part_desc?, sort_order? }], device_info? }', response: '{ id: number }' },
      { method: 'GET', path: '/submissions/mine', description: '我的投稿列表', auth: 'JWT', params: 'page, page_size', response: '{ list: Submission[], total, page, page_size }' },
      { method: 'GET', path: '/submissions/:id', description: '投稿详情', auth: 'JWT', params: 'id', response: 'SubmissionDetail（含歌曲列表）' },
      { method: 'GET', path: '/admin/submissions', description: '投稿管理列表', auth: '管理员', params: 'page, page_size, status, session_id, keyword', response: '{ list, total, page, page_size }' },
      { method: 'GET', path: '/admin/submissions/:id', description: '投稿管理详情', auth: '管理员', response: 'SubmissionDetail' },
      { method: 'PUT', path: '/admin/submissions/:id/status', description: '审核投稿', auth: '管理员', body: '{ status: "pending"|"approved"|"rejected", review_comment? }', response: '{ id, status, review_comment }' },
      { method: 'POST', path: '/admin/submissions/batch', description: '批量审核', auth: '管理员', body: '{ ids: number[], status, review_comment? }', response: '{ affected: number }' },
      { method: 'DELETE', path: '/admin/submissions/:id', description: '删除投稿', auth: '管理员', response: '{ id }' },
      { method: 'DELETE', path: '/admin/submissions/batch', description: '批量删除', auth: '管理员', body: '{ ids: number[] }', response: '{ affected: number }' },
      { method: 'GET', path: '/admin/submissions/export', description: '导出 Excel', auth: '管理员', params: 'session_id（必填）', response: 'Excel 文件下载' },
      { method: 'GET', path: '/admin/submissions/statistics', description: '投稿统计', auth: '管理员', params: 'session_id?', response: '{ hot_songs, custom_songs, session_stats, total_submissions }' },
    ],
  },
  {
    key: 'songs',
    label: '歌曲管理',
    endpoints: [
      { method: 'GET', path: '/admin/songs', description: '歌曲库列表', auth: '管理员', params: 'page, page_size, keyword, status', response: '{ list: Song[], total, page, page_size }' },
      { method: 'GET', path: '/admin/songs/pending', description: '待审核歌曲', auth: '管理员', params: 'page, page_size', response: '{ list, total, page, page_size }' },
      { method: 'POST', path: '/admin/songs', description: '添加歌曲', auth: '管理员', body: '{ song_name, artist_name, alt_title?, remark? }', response: 'Song 对象' },
      { method: 'PUT', path: '/admin/songs/:id', description: '更新歌曲', auth: '管理员', body: 'Partial<Song>', response: 'Song 对象' },
      { method: 'PUT', path: '/admin/songs/:id/status', description: '更新歌曲状态', auth: '管理员', body: '{ status: number }', response: '{ id, status }' },
      { method: 'DELETE', path: '/admin/songs/:id', description: '删除歌曲', auth: '管理员', response: '{ id }' },
    ],
  },
  {
    key: 'users',
    label: '用户管理',
    endpoints: [
      { method: 'GET', path: '/admin/users', description: '用户列表', auth: '管理员', params: 'page, page_size, keyword, role(0|1|2)', response: '{ list: User[]（每项含 status(1|0)、organizer_name）, total, page, page_size }' },
      { method: 'GET', path: '/admin/users/:id', description: '用户详情', auth: '管理员', response: 'User 对象（含 role: 0|1|2、status: 1|0、organizer_name）' },
      { method: 'POST', path: '/admin/users', description: '创建用户（role=2 时 organizer_name 必填；用户名重复返回 409「用户名已被使用」）', auth: '管理员', body: '{ username, password, nickname?, phone?, email?, role?(0|1|2), organizer_name? }', response: 'User 对象' },
      { method: 'PUT', path: '/admin/users/:id', description: '更新用户资料（白名单字段，不能修改自己）', auth: '管理员', body: '{ nickname?, phone?, email?, organizer_name? }', response: 'User 对象' },
      { method: 'PUT', path: '/admin/users/:id/role', description: '修改用户角色（升为 2 时 organizer_name 必填；不能修改自己的角色）', auth: '管理员', body: '{ role: 0|1|2, organizer_name? }', response: '{ id, role, organizer_name }' },
      { method: 'PUT', path: '/admin/users/:id/status', description: '启用/停用用户（不能修改自己的状态）', auth: '管理员', body: '{ status: 1|0 }', response: '{ id, status }' },
    ],
  },
  {
    key: 'organizers',
    label: '主办方（公共）',
    endpoints: [
      { method: 'GET', path: '/organizers', description: '公共主办方列表（无需鉴权，供场次/路演归属选择；status=1 且 organizer_name 非空且 role∈{1,2}）', auth: '无', response: '{ list: [{ id, name }], total }' },
    ],
  },
  {
    key: 'dashboard',
    label: '仪表盘',
    endpoints: [
      { method: 'GET', path: '/admin/dashboard', description: '数据概览', auth: '管理员', response: '{ summary, pending, trend, upcoming_sessions, recent_activity, system_health, generated_at }' },
    ],
  },
  {
    key: 'upload',
    label: '文件上传',
    endpoints: [
      { method: 'POST', path: '/upload', description: '上传文件（路演剪辑版音频等）', auth: 'JWT', body: 'multipart/form-data: file', response: '{ url, filename, originalname }' },
    ],
  },
  {
    key: 'logs',
    label: '日志与事件',
    endpoints: [
      { method: 'GET', path: '/admin/system-logs', description: '系统日志列表', auth: '管理员', params: 'page, page_size, level, type, keyword', response: '{ list: SystemLog[], total, page, page_size }' },
      { method: 'GET', path: '/admin/system-logs/:id', description: '系统日志详情', auth: '管理员', response: 'SystemLog 对象' },
      { method: 'DELETE', path: '/admin/system-logs/:id', description: '删除单条日志', auth: '管理员', response: '{ id }' },
      { method: 'DELETE', path: '/admin/system-logs/batch', description: '批量删除日志', auth: '管理员', body: '{ ids: number[] }', response: '{ affected }' },
      { method: 'DELETE', path: '/admin/system-logs/clear', description: '清空所有日志', auth: '管理员', response: '{ cleared: true }' },
      { method: 'POST', path: '/client-events', description: '客户端事件上报', auth: '无', body: '{ event_id, event_type, platform?, device_id?, ... }', response: '{ id }' },
      { method: 'GET', path: '/admin/client-events', description: '客户端事件列表', auth: '管理员', params: 'page, page_size, event_type, keyword', response: '{ list, total, page, page_size }' },
      { method: 'DELETE', path: '/admin/client-events/:id', description: '删除事件', auth: '管理员', response: '{ id }' },
      { method: 'DELETE', path: '/admin/client-events/batch', description: '批量删除事件', auth: '管理员', body: '{ ids: number[] }', response: '{ affected }' },
    ],
  },
  {
    key: 'fastapi',
    label: '音源服务（FastAPI 代理）',
    endpoints: [
      { method: 'GET', path: '/fa-api/songs', description: '获取歌曲列表', auth: '无', params: 'page, page_size, search, artist', response: '{ songs: FastAPISong[], total, page, page_size }' },
      { method: 'GET', path: '/fa-api/songs/:id', description: '获取歌曲详情', auth: '无', params: 'id', response: 'FastAPISong 对象' },
      { method: 'GET', path: '/fa-api/songs/artists', description: '获取歌手列表', auth: '无', response: '{ artists: string[] }' },
      { method: 'GET', path: '/fa-api/playlists', description: '获取歌单列表', auth: '无', response: 'FastAPIPlaylist[]' },
      { method: 'GET', path: '/fa-api/playlists/:id', description: '获取歌单详情', auth: '无', params: 'id', response: 'FastAPIPlaylistDetail' },
      { method: 'GET', path: '/fa-api/songs/stream/:id', description: '全曲音频流', auth: '无', params: 'id', response: '音频流' },
      { method: 'GET', path: '/fa-api/songs/stream/chorus/:id', description: '副歌音频流', auth: '无', params: 'id', response: '音频流' },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: 'blue',
  POST: 'green',
  PUT: 'orange',
  PATCH: 'purple',
  DELETE: 'red',
};

export default function ApiDocsPage() {
  const [search, setSearch] = useState('');

  const filteredGroups = apiGroups.map((group) => ({
    ...group,
    endpoints: group.endpoints.filter(
      (ep) =>
        !search ||
        ep.path.toLowerCase().includes(search.toLowerCase()) ||
        ep.description.includes(search) ||
        ep.method.includes(search.toUpperCase()),
    ),
  })).filter((g) => g.endpoints.length > 0);

  const totalCount = apiGroups.reduce((sum, g) => sum + g.endpoints.length, 0);

  return (
    <Card
      title={
        <Space>
          <CodeOutlined />
          <span>API 文档</span>
          <Tag color="blue">{totalCount} 个接口</Tag>
        </Space>
      }
      extra={
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索路径 / 描述 / 方法"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 280 }}
          allowClear
        />
      }
    >
      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 16 }}
        message="本页为站内精简接口索引，可能滞后于后端实现"
        description={
          <span>
            最新、完整的接口文档（含选位 / 编排 / 媒体直传 / 对象存储等新接口）请见
            <Link href="/docs/" target="_blank" rel="noreferrer"> 静态文档站 </Link>
            （<Text code>/docs/</Text>）。本页与文档站如有出入，以文档站为准。
          </span>
        }
      />
      <Paragraph type="secondary" style={{ marginBottom: 24 }}>
        所有接口基础路径为 <Text code>/api/v1</Text>。需要认证的接口请在请求头携带
        <Text code> Authorization: Bearer {'<token>'}</Text>。
        管理员接口需要 JWT 且用户角色为管理员（role=1）。角色枚举：0=普通用户 / 1=超级管理员 / 2=主办方；User 对象含 status（1 启用 / 0 停用）与 organizer_name（主办方对外展示名，非主办方为 null）。
      </Paragraph>

      <Tabs
        items={filteredGroups.map((group) => ({
          key: group.key,
          label: (
            <Space>
              <span>{group.label}</span>
              <Tag>{group.endpoints.length}</Tag>
            </Space>
          ),
          children: (
            <Table
              dataSource={group.endpoints}
              rowKey={(r) => `${r.method}-${r.path}`}
              pagination={false}
              size="middle"
              columns={[
                {
                  title: '方法',
                  dataIndex: 'method',
                  width: 80,
                  render: (v: string) => <Tag color={methodColors[v]} style={{ fontWeight: 700 }}>{v}</Tag>,
                },
                {
                  title: '路径',
                  dataIndex: 'path',
                  width: 320,
                  render: (v: string) => <Text code copyable style={{ fontSize: 13 }}>{v}</Text>,
                },
                { title: '说明', dataIndex: 'description', width: 200 },
                {
                  title: '认证',
                  dataIndex: 'auth',
                  width: 100,
                  render: (v: string) => {
                    if (v === '无') return <Tag>无</Tag>;
                    if (v === 'JWT') return <Tag color="blue">JWT</Tag>;
                    if (v.includes('管理员')) return <Tag color="red">管理员</Tag>;
                    return <Tag>{v}</Tag>;
                  },
                },
                {
                  title: '参数 / 请求体',
                  render: (_, r) => (
                    <div>
                      {r.params && (
                        <div style={{ marginBottom: 4 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>参数: </Text>
                          <Text code style={{ fontSize: 12 }}>{r.params}</Text>
                        </div>
                      )}
                      {r.body && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>Body: </Text>
                          <Text code style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{r.body}</Text>
                        </div>
                      )}
                      {!r.params && !r.body && <Text type="secondary">-</Text>}
                    </div>
                  ),
                },
                {
                  title: '响应',
                  dataIndex: 'response',
                  render: (v: string) => v ? <Text code style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{v}</Text> : <Text type="secondary">-</Text>,
                },
              ]}
            />
          ),
        }))}
      />
    </Card>
  );
}
