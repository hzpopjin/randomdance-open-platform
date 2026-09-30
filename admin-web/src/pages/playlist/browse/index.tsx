import { useState, useEffect, useCallback } from 'react';
import { Card, Input, Button, Table, Tag, Select, Space, message, Typography, Row, Col, List, Divider, Modal } from 'antd';
const { Title, Text, Paragraph } = Typography;
import { SearchOutlined, PlusOutlined, MinusCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getSongs as getFastApiSongs, getArtists } from '../../../services/fastapi';
import { getAvailableSessions, getOrganizers } from '../../../services/registration';
import { submitSubmission } from '../../../services/user-submissions';
import { PLAY_PART_MAP } from '../../../config/constants';
import type { FastAPISong } from '../../../types/fastapi';


interface SelectedSong {
  key: string;
  song_id?: number;
  song_name: string;
  artist_name: string;
  alt_title?: string;
  full_title?: string;
  file_extension?: string;
  full_file_path?: string;
  chorus_file_path?: string;
  reference_url?: string;
  play_part: number;
  custom_part_desc?: string;
  is_custom?: boolean;
}

export default function PlaylistBrowsePage() {
  const [songs, setSongs] = useState<FastAPISong[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [artists, setArtists] = useState<string[]>([]);
  const [selectedArtist, setSelectedArtist] = useState<string>('');
  const [selectedSongs, setSelectedSongs] = useState<SelectedSong[]>([]);
  const [organizers, setOrganizers] = useState<{ id: number; name: string }[]>([]);
  const [organizerId, setOrganizerId] = useState<number>();
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionId, setSessionId] = useState<number>();
  const [submitting, setSubmitting] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customForm, setCustomForm] = useState({ song_name: '', artist_name: '', reference_url: '', play_part: 1, custom_part_desc: '' });
  const navigate = useNavigate();

  const fetchSongs = useCallback(async (p = 1, s = search, a = selectedArtist) => {
    setLoading(true);
    try {
      const res = await getFastApiSongs({ page: p, page_size: 20, search: s || undefined, artist: a || undefined });
      setSongs(res.songs); setTotal(res.total); setPage(p);
    } catch (e: any) { message.error('获取歌曲列表失败'); }
    finally { setLoading(false); }
  }, [search, selectedArtist]);

  useEffect(() => {
    fetchSongs(1);
    getArtists().then(setArtists).catch(() => {});
    getOrganizers().then((res) => setOrganizers(res.data.list)).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setSessionId(undefined);
    if (organizerId == null) {
      setSessions([]);
      return () => { cancelled = true; };
    }
    getAvailableSessions(organizerId)
      .then((res) => { if (!cancelled) setSessions(res.data.list); })
      .catch(() => { if (!cancelled) setSessions([]); });
    return () => { cancelled = true; };
  }, [organizerId]);

  const addSong = (song: FastAPISong) => {
    const key = `song-${song.id}`;
    if (selectedSongs.find((s) => s.key === key)) { message.warning('已添加该歌曲'); return; }
    setSelectedSongs([...selectedSongs, {
      key, song_id: song.id, song_name: song.title, artist_name: song.artist,
      alt_title: song.alt_title || undefined, full_title: song.full_title || undefined,
      file_extension: song.file_extension, full_file_path: song.full_file_path,
      chorus_file_path: song.chorus_file_path || undefined, play_part: 1,
    }]);
  };

  const addCustomSong = () => {
    if (!customForm.song_name || !customForm.artist_name) { message.warning('请填写歌曲名和歌手'); return; }
    const key = `custom-${Date.now()}`;
    setSelectedSongs([...selectedSongs, {
      key, song_name: customForm.song_name, artist_name: customForm.artist_name,
      reference_url: customForm.reference_url, play_part: customForm.play_part,
      custom_part_desc: customForm.play_part === 2 ? customForm.custom_part_desc : undefined, is_custom: true,
    }]);
    setCustomForm({ song_name: '', artist_name: '', reference_url: '', play_part: 1, custom_part_desc: '' });
    setShowCustom(false);
  };

  const removeSong = (key: string) => setSelectedSongs(selectedSongs.filter((s) => s.key !== key));

  const updatePlayPart = (key: string, play_part: number) => {
    setSelectedSongs(selectedSongs.map((s) => s.key === key ? { ...s, play_part } : s));
  };

  const handleSubmit = async () => {
    if (!sessionId) { message.warning('请选择投稿场次'); return; }
    if (selectedSongs.length === 0) { message.warning('请至少选择一首歌曲'); return; }
    setSubmitting(true);
    try {
      await submitSubmission({
        session_id: sessionId,
        songs: selectedSongs.map((s, i) => ({
          song_id: s.song_id ?? null, song_name: s.song_name, artist_name: s.artist_name,
          alt_title: s.alt_title, full_title: s.full_title, file_extension: s.file_extension,
          full_file_path: s.full_file_path, chorus_file_path: s.chorus_file_path,
          reference_url: s.reference_url, play_part: s.play_part,
          custom_part_desc: s.custom_part_desc, sort_order: i,
        })),
      });
      message.success('投稿成功');
      navigate('/playlist/mine');
    } catch (e: any) { message.error(e.message || '投稿失败'); }
    finally { setSubmitting(false); }
  };

  const columns = [
    { title: '歌曲名', dataIndex: 'title', render: (v: string, r: FastAPISong) => v + (r.alt_title ? ` (${r.alt_title})` : '') },
    { title: '歌手', dataIndex: 'artist' },
    { title: '格式', dataIndex: 'file_extension', width: 80 },
    { title: '操作', width: 80, render: (_: any, r: FastAPISong) => (
      <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => addSong(r)}>添加</Button>
    )},
  ];

  return (
    <div className="rd-page-shell" style={{ padding: '32px 0' }}>
      <div className="rd-container">
        <Title level={3}>随舞歌单投稿</Title>
        <Row gutter={[20, 20]}>
          <Col xs={24} lg={14}>
            <Card className="rd-glass-card" title="曲库歌曲" style={{ borderRadius: 20 }} styles={{ body: { padding: 16 } }}>
              <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
                <Space wrap>
                  <Input.Search placeholder="搜索歌曲名/歌手" value={search} onChange={(e) => setSearch(e.target.value)}
                    onSearch={() => fetchSongs(1)} style={{ width: 240 }} />
                  <Select placeholder="按歌手筛选" value={selectedArtist || undefined} onChange={(v) => { setSelectedArtist(v || ''); fetchSongs(1, search, v || ''); }}
                    allowClear style={{ width: 160 }} options={artists.map((a) => ({ value: a, label: a }))} />
                </Space>
              </Space>
              <Table columns={columns} dataSource={songs} rowKey="id" loading={loading} size="small"
                pagination={{ current: page, total, pageSize: 20, onChange: (p) => fetchSongs(p), showSizeChanger: false }} />
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card className="rd-glass-card" title="已选歌曲" style={{ borderRadius: 20, position: 'sticky', top: 80 }} styles={{ body: { padding: 16 } }}>
              <div style={{ marginBottom: 16 }}>
                <Text strong>主办方：</Text>
                <Select placeholder="请先选择主办方" value={organizerId} onChange={setOrganizerId} style={{ width: '100%', marginTop: 8, marginBottom: 12 }}
                  options={organizers.map((o) => ({ value: o.id, label: o.name }))} />
                <Text strong>投稿场次：</Text>
                <Select placeholder={organizerId == null ? '请先选择主办方' : '请选择场次'} disabled={organizerId == null}
                  value={sessionId} onChange={setSessionId} style={{ width: '100%', marginTop: 8 }}
                  options={sessions.map((s) => ({ value: s.id, label: `${s.name}（${s.event_date?.slice(0,10)}）` }))} />
              </div>
              <Button icon={<PlusOutlined />} block type="dashed" onClick={() => setShowCustom(true)} style={{ marginBottom: 12 }}>
                添加自定义歌曲
              </Button>
              {selectedSongs.length === 0 ? (
                <Text type="secondary">尚未选择歌曲，请从左侧曲库添加或添加自定义歌曲</Text>
              ) : (
                <List dataSource={selectedSongs} renderItem={(song, index) => (
                  <List.Item style={{ padding: '8px 0', flexDirection: 'column', alignItems: 'stretch' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                      <Space>
                        {song.is_custom && <Tag color="purple">自定义</Tag>}
                        <Text>{index + 1}. {song.song_name} - {song.artist_name}</Text>
                      </Space>
                      <MinusCircleOutlined style={{ color: '#ff4d4f' }} onClick={() => removeSong(song.key)} />
                    </div>
                    <Select size="small" value={song.play_part} onChange={(v) => updatePlayPart(song.key, v)} style={{ width: 120, marginTop: 4 }}
                      options={[{ value: 0, label: '全曲' }, { value: 1, label: '副歌' }, { value: 2, label: '自定义' }]} />
                  </List.Item>
                )} />
              )}
              <Divider style={{ margin: '12px 0' }} />
              <Button type="primary" block size="large" loading={submitting} disabled={selectedSongs.length === 0} onClick={handleSubmit}>
                提交投稿 ({selectedSongs.length})
              </Button>
            </Card>
          </Col>
        </Row>
        <Modal title="添加自定义歌曲" open={showCustom} onCancel={() => setShowCustom(false)} onOk={addCustomSong}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Input placeholder="歌曲名 *" value={customForm.song_name} onChange={(e) => setCustomForm({ ...customForm, song_name: e.target.value })} />
            <Input placeholder="歌手 *" value={customForm.artist_name} onChange={(e) => setCustomForm({ ...customForm, artist_name: e.target.value })} />
            <Input placeholder="参考链接（QQ音乐/B站等）" value={customForm.reference_url} onChange={(e) => setCustomForm({ ...customForm, reference_url: e.target.value })} />
            <Select value={customForm.play_part} onChange={(v) => setCustomForm({ ...customForm, play_part: v })} style={{ width: '100%' }}
              options={[{ value: 0, label: '全曲' }, { value: 1, label: '副歌' }, { value: 2, label: '自定义' }]} />
            {customForm.play_part === 2 && <Input placeholder="自定义段落描述" value={customForm.custom_part_desc} onChange={(e) => setCustomForm({ ...customForm, custom_part_desc: e.target.value })} />}
          </Space>
        </Modal>
      </div>
    </div>
  );
}
