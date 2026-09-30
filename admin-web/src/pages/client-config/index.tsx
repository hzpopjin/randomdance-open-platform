import { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Input, message, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { getClientConfigs, setClientConfig } from '../../services/client-config';

export default function ClientConfigPage() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getClientConfigs();
      setData(res.data);
    } catch (e: any) { message.error(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      let configValue = values.config_value;
      try { configValue = JSON.parse(values.config_value); } catch {}
      await setClientConfig(values.config_key, configValue);
      message.success('保存成功');
      setModalOpen(false); form.resetFields();
      fetchData();
    } catch (e: any) { message.error(e.message); }
  };

  const columns = [
    { title: '配置键', dataIndex: 'config_key' },
    { title: '配置值', dataIndex: 'config_value', render: (v: any) => JSON.stringify(v) },
  ];

  return (
    <Card title="云端控制配置" extra={<Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>添加配置</Button>}>
      <Table columns={columns} dataSource={data} rowKey="config_key" loading={loading} pagination={false} />
      <Modal title="配置项" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={handleSave}>
        <Form form={form} layout="vertical">
          <Form.Item name="config_key" label="配置键" rules={[{ required: true }]}><Input placeholder="如 wechat-miniapp" /></Form.Item>
          <Form.Item name="config_value" label="配置值（JSON格式）" rules={[{ required: true }]}><Input.TextArea rows={6} placeholder='{"key": "value"}' /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
