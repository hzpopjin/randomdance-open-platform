import { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, message, Space, Input, Select } from 'antd';
import { getSongs as getFastApiSongs, getArtists, getPlaylists, getPlaylistDetail, getFullStreamUrl, getChorusStreamUrl } from '../../services/fastapi';
import type { FastAPISong, FastAPIPlaylist } from '../../types/fastapi';

export default function PlaylistPage() {
  const [songs, setSongs] = useState<FastAPISong[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [artists, setArtists] = useState<string[]>([]);
  const [selectedArtist, setSelectedArtist] = useState('');
  const [playlists, setPlaylists] = useState<FastAPIPlaylist[]>([]);

  const fetchSongs = async (p = 1, s = search, a = selectedArtist) => {
    setLoading(true);
    try {
      const res = await getFastApiSongs({ page: p, page_size: 20, search: s || undefined, artist: a || undefined });
      setSongs(res.songs); setTotal(res.total); setPage(p);
    } catch { message.error('获取歌曲失败'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchSongs(1);
    getArtists().then(setArtists).catch(() => {});
    getPlaylists().then(setPlaylists).catch(() => {});
  }, []);

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '歌曲名', dataIndex: 'title', render: (v: string, r: FastAPISong) => v + (r.alt_title ? ` (${r.alt_title})` : '') },
    { title: '歌手', dataIndex: 'artist' },
    { title: '格式', dataIndex: 'file_extension', width: 80 },
    { title: '全曲', width: 80, render: (_: any, r: FastAPISong) => <a href={getFullStreamUrl(r.id)} target="_blank" rel="noreferrer">播放</a> },
    { title: '副歌', width: 80, render: (_: any, r: FastAPISong) => r.chorus_file_path ? <a href={getChorusStreamUrl(r.id)} target="_blank" rel="noreferrer">播放</a> : '-' },
  ];

  return (
    <Card title="随机舞蹈歌单（FastAPI 音源）">
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search placeholder="搜索歌曲" style={{ width: 240 }} value={search} onChange={(e) => setSearch(e.target.value)} onSearch={() => fetchSongs(1)} allowClear />
        <Select placeholder="按歌手" allowClear style={{ width: 160 }} value={selectedArtist || undefined} onChange={(v) => { setSelectedArtist(v || ''); fetchSongs(1, search, v || ''); }} options={artists.map((a) => ({ value: a, label: a }))} />
      </Space>
      <Table columns={columns} dataSource={songs} rowKey="id" loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: (p) => fetchSongs(p), showSizeChanger: false }} size="small" />
      {playlists.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <h4>歌单列表</h4>
          <Space wrap>
            {playlists.map((pl) => <Tag key={pl.id} color="blue">{pl.name} ({pl.song_ids?.length || 0}首)</Tag>)}
          </Space>
        </div>
      )}
    </Card>
  );
}
