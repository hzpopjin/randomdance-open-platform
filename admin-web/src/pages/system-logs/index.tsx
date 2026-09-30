import { useState, useEffect } from 'react';
import { Card, Table, Tag, Input, Select, message, Space, Button, Popconfirm, Drawer, Descriptions, Modal } from 'antd';
import { getSystemLogs, deleteSystemLog, batchDeleteSystemLogs, clearAllSystemLogs, type SystemLog } from '../../services/system-logs';
import dayjs from 'dayjs';

export default function SystemLogsPage() {
  const [data, setData] = useState<SystemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<any>({ level: undefined, type: undefined, keyword: '' });
  const [selectedRowKeys, setSelectedRowKeys] = useState<number[]>([]);
  const [detail, setDetail] = useState<SystemLog | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchData = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getSystemLogs({ page: p, page_size: 10, ...filters });
      setData(res.data.list as SystemLog[]); setTotal(res.data.total); setPage(p);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const levelColors: Record<string, string> = { info: 'blue', warn: 'orange', error: 'red' };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '级别', dataIndex: 'level', width: 80, render: (v: string) => <Tag color={levelColors[v] || 'default'}>{v}</Tag> },
    { title: '类型', dataIndex: 'type', width: 100 },
    { title: '方法', dataIndex: 'method', width: 70 },
    { title: '路径', dataIndex: 'path', ellipsis: true },
    { title: '状态码', dataIndex: 'status_code', width: 80 },
    { title: '耗时', dataIndex: 'duration_ms', width: 70, render: (v: number) => v ? `${v}ms` : '-' },
    { title: '消息', dataIndex: 'message', ellipsis: true },
    { title: '时间', dataIndex: 'created_at', width: 140, render: (v: string) => dayjs(v).format('MM-DD HH:mm:ss') },
    { title: '操作', width: 80, render: (_: any, r: SystemLog) => <Button size="small" onClick={() => { setDetail(r); setDrawerOpen(true); }}>详情</Button> },
  ];

  return (
    <Card title="系统日志" extra={<Popconfirm title="确认清空所有日志？此操作不可恢复。" onConfirm={() => clearAllSystemLogs().then(() => { message.success('已清空'); fetchData(); })}>
      <Button danger>清空全部</Button>
    </Popconfirm>}>
      <Space style={{ marginBottom: 16 }} wrap>
        <Select placeholder="级别" allowClear style={{ width: 100 }} value={filters.level} onChange={(v) => setFilters({ ...filters, level: v })} options={[{ value: 'info', label: 'Info' }, { value: 'warn', label: 'Warn' }, { value: 'error', label: 'Error' }]} />
        <Select placeholder="类型" allowClear style={{ width: 140 }} value={filters.type} onChange={(v) => setFilters({ ...filters, type: v })} options={[{ value: 'api_request', label: 'API请求' }, { value: 'api_error', label: 'API错误' }]} />
        <Input.Search placeholder="搜索消息/路径" style={{ width: 240 }} value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} onSearch={() => fetchData(1)} allowClear />
        <Button onClick={() => fetchData(1)}>查询</Button>
      </Space>
      {selectedRowKeys.length > 0 && (
        <Space style={{ marginBottom: 16 }}>
          <span>已选 {selectedRowKeys.length} 项</span>
          <Popconfirm title="确认删除选中项？" onConfirm={() => batchDeleteSystemLogs(selectedRowKeys).then(() => { message.success('删除成功'); setSelectedRowKeys([]); fetchData(page); })}>
            <Button size="small" danger>批量删除</Button>
          </Popconfirm>
        </Space>
      )}
      <Table columns={columns} dataSource={data} rowKey="id" loading={loading}
        rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys as number[]) }}
        pagination={{ current: page, total, pageSize: 10, onChange: fetchData }} />
      <Drawer title="日志详情" open={drawerOpen} onClose={() => setDrawerOpen(false)} width={600}>
        {detail && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{detail.id}</Descriptions.Item>
            <Descriptions.Item label="级别"><Tag color={levelColors[detail.level]}>{detail.level}</Tag></Descriptions.Item>
            <Descriptions.Item label="类型">{detail.type}</Descriptions.Item>
            <Descriptions.Item label="方法">{detail.method || '-'}</Descriptions.Item>
            <Descriptions.Item label="路径">{detail.path || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态码">{detail.status_code ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="业务码">{detail.business_code ?? '-'}</Descriptions.Item>
            <Descriptions.Item label="消息">{detail.message || '-'}</Descriptions.Item>
            <Descriptions.Item label="耗时">{detail.duration_ms ? `${detail.duration_ms}ms` : '-'}</Descriptions.Item>
            <Descriptions.Item label="IP">{detail.ip || '-'}</Descriptions.Item>
            <Descriptions.Item label="User Agent">{detail.user_agent || '-'}</Descriptions.Item>
            <Descriptions.Item label="用户ID">{detail.user_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="请求ID">{detail.request_id || '-'}</Descriptions.Item>
            <Descriptions.Item label="Query参数">{JSON.stringify(detail.query_payload, null, 2)}</Descriptions.Item>
            <Descriptions.Item label="请求体">{JSON.stringify(detail.request_payload, null, 2)}</Descriptions.Item>
            <Descriptions.Item label="响应体">{JSON.stringify(detail.response_payload, null, 2)}</Descriptions.Item>
            {detail.error_stack && <Descriptions.Item label="错误堆栈"><pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{detail.error_stack}</pre></Descriptions.Item>}
            <Descriptions.Item label="时间">{dayjs(detail.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          </Descriptions>
        )}
      </Drawer>
    </Card>
  );
}
