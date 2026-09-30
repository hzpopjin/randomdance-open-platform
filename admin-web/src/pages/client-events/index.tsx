import { useState, useEffect } from 'react';
import { Card, Table, Tag, Input, Select, message, Space, Button, Popconfirm, Drawer, Descriptions } from 'antd';
import { getClientEvents, deleteClientEvent, batchDeleteClientEvents, type ClientEvent } from '../../services/client-events';
import dayjs from 'dayjs';

export default function ClientEventsPage() {
  const [data, setData] = useState<ClientEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<any>({ event_type: undefined, keyword: '' });
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [detail, setDetail] = useState<ClientEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchData = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getClientEvents({ page: p, page_size: 10, ...filters });
      setData(res.data.list as ClientEvent[]); setTotal(res.data.total); setPage(p);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '事件类型', dataIndex: 'event_type', width: 120, render: (v: string) => <Tag>{v}</Tag> },
    { title: '事件ID', dataIndex: 'event_id', ellipsis: true },
    { title: '平台', dataIndex: 'platform', width: 80 },
    { title: '设备ID', dataIndex: 'device_id', ellipsis: true },
    { title: 'IP', dataIndex: 'ip', width: 120 },
    { title: '接收时间', dataIndex: 'received_at', width: 140, render: (v: string) => dayjs(v).format('MM-DD HH:mm:ss') },
    { title: '操作', width: 80, render: (_: any, r: ClientEvent) => <Button size="small" onClick={() => { setDetail(r); setDrawerOpen(true); }}>详情</Button> },
  ];

  return (
    <Card title="客户端事件日志">
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search placeholder="搜索事件ID/设备ID" style={{ width: 240 }} value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} onSearch={() => fetchData(1)} allowClear />
        <Button onClick={() => fetchData(1)}>查询</Button>
      </Space>
      {selectedRowKeys.length > 0 && (
        <Space style={{ marginBottom: 16 }}>
          <span>已选 {selectedRowKeys.length} 项</span>
          <Popconfirm title="确认删除选中项？" onConfirm={() => batchDeleteClientEvents(selectedRowKeys).then(() => { message.success('删除成功'); setSelectedRowKeys([]); fetchData(page); })}>
            <Button size="small" danger>批量删除</Button>
          </Popconfirm>
        </Space>
      )}
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as number[]) }}
        pagination={{ current: page, total, pageSize: 10, onChange: fetchData }} />
      <Drawer title="事件详情" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={500}>
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
            <Descriptions.Item label="事件类型">{detail.event_type}</Descriptions.Item>
            <Descriptions.Item label="事件ID">{detail.event_id}</Descriptions.Item>
            <Descriptions.Item label="平台">{detail.platform || '-'}</Descriptions.Item>
            <Descriptions.Item label="设备ID">{detail.device_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="请求ID">{detail.request_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="UID">{detail.uid || '-'}</Descriptions.Item>
            <Descriptions.Item label="IP">{detail.ip || '-'}</Descriptions.Item>
            <Descriptions.Item label="User Agent">{detail.user_agent || '-'}</Descriptions.Item>
            <Descriptions.Item label="资源类型">{detail.resource_type || '-'}</Descriptions.Item>
            <Descriptions.Item label="资源ID">{detail.resource_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="App版本">{detail.app_version || '-'}</Descriptions.Item>
            <Descriptions.Item label="设备型号">{detail.device_model || '-'}</Descriptions.Item>
            <Descriptions.Item label="系统版本">{detail.os_version || '-'}</Descriptions.Item>
            <Descriptions.Item label="上下文">{JSON.stringify(detail.context_payload, null, 2)}</Descriptions.Item>
            <Descriptions.Item label="发生时间">{detail.occurred_at ? dayjs(detail.occurred_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
            <Descriptions.Item label="接收时间">{detail.received_at ? dayjs(detail.received_at).format('YYYY-MM-DD HH:mm:ss') : '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </Card>
  );
}
