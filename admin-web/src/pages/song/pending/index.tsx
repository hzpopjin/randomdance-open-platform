import { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space, message, Popconfirm } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { getPendingSongs, updateSongStatus } from '../../../services/songs';

export default function PendingSongPage() {
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const fetchData = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getPendingSongs({ page: p, page_size: 10 });
      setData(res.data.list); setTotal(res.data.total); setPage(p);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '歌曲名', dataIndex: 'song_name' },
    { title: '歌手', dataIndex: 'artist_name' },
    { title: '次要歌名', dataIndex: 'alt_title' },
    { title: '备注', dataIndex: 'remark' },
    { title: '状态', dataIndex: 'status', width: 80, render: () => <Tag color="orange">待审核</Tag> },
    { title: '操作', width: 140, render: (_: any, r: any) => (
      <Space>
        <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => updateSongStatus(r.id, 1).then(() => { message.success('已通过'); fetchData(page); })}>通过</Button>
        <Popconfirm title="确认拒绝？" onConfirm={() => updateSongStatus(r.id, 2).then(() => { message.success('已拒绝'); fetchData(page); })}>
          <Button size="small" danger icon={<CloseOutlined />}>拒绝</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <Card title="待审核歌曲">
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        pagination={{ current: page, total, pageSize: 10, onChange: fetchData }} />
    </Card>
  );
}
