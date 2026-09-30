import { Button, Modal, Select, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useState } from 'react';

interface ExportButtonProps {
  sessions: { id: number; name: string }[];
  onExport: (sessionId: number, status?: string) => Promise<Blob>;
  defaultSessionId?: number;
  hasStatus?: boolean;
}

export default function ExportButton({ sessions, onExport, defaultSessionId, hasStatus }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<number | undefined>(defaultSessionId);
  const [status, setStatus] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!sessionId) { message.warning('请选择场次'); return; }
    setLoading(true);
    try {
      const blob = await onExport(sessionId, status);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export_${sessionId}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      setOpen(false);
      message.success('导出成功');
    } catch (e: any) {
      message.error(e.message || '导出失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button icon={<DownloadOutlined />} onClick={() => { setSessionId(defaultSessionId); setOpen(true); }}>导出</Button>
      <Modal title="导出数据" open={open} onCancel={() => setOpen(false)} onOk={handleExport} confirmLoading={loading} okText="导出" cancelText="取消">
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>选择场次</label>
          <Select style={{ width: '100%' }} value={sessionId} onChange={setSessionId} placeholder="请选择场次"
            options={sessions.map((s) => ({ value: s.id, label: s.name }))} />
        </div>
        {hasStatus && (
          <div>
            <label style={{ display: 'block', marginBottom: 8 }}>审核状态（可选）</label>
            <Select style={{ width: '100%' }} value={status} onChange={setStatus} allowClear placeholder="全部状态"
              options={[{ value: 'pending', label: '待审核' }, { value: 'approved', label: '已通过' }, { value: 'rejected', label: '已驳回' }]} />
          </div>
        )}
      </Modal>
    </>
  );
}
