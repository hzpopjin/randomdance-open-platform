import { useEffect } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Form,
  Input,
  Row,
  Space,
  Spin,
  Switch,
  Tag,
  Typography,
  message,
} from 'antd';
import {
  ApiOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getObjectStorageConfig,
  testObjectStorageConnection,
  updateObjectStorageConfig,
} from '../../services/object-storage';
import type { UpdateObjectStorageConfigInput } from '../../types/object-storage';

const { Link, Text, Title } = Typography;

const DEFAULT_ROADSHOW_MEDIA_NAME_TEMPLATE = '{registrationNumber}_{songName}_{groupName}';
const ROADSHOW_MEDIA_NAME_VARIABLES = [
  { token: 'registrationNumber', label: '报名序号（报名 ID）' },
  { token: 'songName', label: '歌曲名' },
  { token: 'groupName', label: '组名' },
  { token: 'artistName', label: '歌手名' },
  { token: 'sessionId', label: '场次 ID' },
  { token: 'sessionName', label: '场次名' },
  { token: 'mediaTypeName', label: '音频 / 审核视频' },
  { token: 'timestamp', label: '上传时间' },
  { token: 'random', label: '随机编号' },
];

// 后端允许的完整变量集（含英文别名与中文别名），避免前端过度拦截合法模板
const ALLOWED_ROADSHOW_MEDIA_NAME_TOKENS = new Set([
  ...ROADSHOW_MEDIA_NAME_VARIABLES.map((item) => item.token),
  'registrationId', 'mediaType',
  '报名序号', '报名ID', '歌曲名', '组名', '歌手名', '场次ID',
  '场次名', '素材类型', '素材类型名', '上传时间', '随机编号',
]);

interface ObjectStorageFormValues extends UpdateObjectStorageConfigInput {
  accessKeySecret?: string;
}

export default function ObjectStoragePage() {
  const [form] = Form.useForm<ObjectStorageFormValues>();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['admin-object-storage'],
    queryFn: getObjectStorageConfig,
  });
  const config = data?.data;

  useEffect(() => {
    if (!config) return;
    form.setFieldsValue({
      enabled: config.enabled,
      accessKeyId: config.accessKeyId,
      accessKeySecret: undefined,
      region: config.region,
      endpoint: config.endpoint,
      bucket: config.bucket,
      publicBaseUrl: config.publicBaseUrl,
      keyPrefix: config.keyPrefix,
      roadshowMediaNameTemplate: config.roadshowMediaNameTemplate || DEFAULT_ROADSHOW_MEDIA_NAME_TEMPLATE,
    });
  }, [config, form]);

  const saveMutation = useMutation({
    mutationFn: (values: ObjectStorageFormValues) => {
      const payload: UpdateObjectStorageConfigInput = {
        enabled: values.enabled ?? false,
        accessKeyId: values.accessKeyId?.trim() || '',
        region: values.region?.trim() || 'cn-beijing',
        endpoint: values.endpoint?.trim() || 'tos-cn-beijing.volces.com',
        bucket: values.bucket?.trim() || '',
        publicBaseUrl: values.publicBaseUrl?.trim() || undefined,
        keyPrefix: values.keyPrefix?.trim() || '',
        roadshowMediaNameTemplate: values.roadshowMediaNameTemplate?.trim() || DEFAULT_ROADSHOW_MEDIA_NAME_TEMPLATE,
      };
      if (values.accessKeySecret?.trim()) {
        payload.accessKeySecret = values.accessKeySecret.trim();
      }
      return updateObjectStorageConfig(payload);
    },
    onSuccess: () => {
      message.success('对象存储配置已保存');
      form.setFieldValue('accessKeySecret', undefined);
      queryClient.invalidateQueries({ queryKey: ['admin-object-storage'] });
    },
    onError: (error: Error) => message.error(`保存失败：${error.message}`),
  });

  const testMutation = useMutation({
    mutationFn: testObjectStorageConnection,
    onSuccess: (response) => {
      message.success(`Bucket ${response.data.bucket} 连接成功`);
    },
    onError: (error: Error) => message.error(error.message),
  });

  const resetForm = () => {
    if (!config) return;
    form.setFieldsValue({
      enabled: config.enabled,
      accessKeyId: config.accessKeyId,
      accessKeySecret: undefined,
      region: config.region,
      endpoint: config.endpoint,
      bucket: config.bucket,
      publicBaseUrl: config.publicBaseUrl,
      keyPrefix: config.keyPrefix,
      roadshowMediaNameTemplate: config.roadshowMediaNameTemplate || DEFAULT_ROADSHOW_MEDIA_NAME_TEMPLATE,
    });
  };

  if (isLoading) {
    return <Spin size="large" style={{ display: 'block', marginTop: 100 }} />;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <Space size={10} align="center">
            <Title level={2} style={{ margin: 0 }}>对象存储配置</Title>
            <Tag color={config?.enabled ? 'success' : 'default'}>
              {config?.enabled ? 'TOS 已启用' : '本地存储'}
            </Tag>
          </Space>
          <div style={{ marginTop: 6 }}>
            <Text type="secondary">为路演音频与审核视频上传配置火山引擎对象存储 TOS</Text>
          </div>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={resetForm}>重置</Button>
          <Button
            icon={<ApiOutlined />}
            loading={testMutation.isPending}
            onClick={() => {
              message.info('测试连接将使用已保存的配置；若有未保存的修改，请先保存后再测试');
              testMutation.mutate();
            }}
          >
            测试连接
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            loading={saveMutation.isPending}
            onClick={() => form.validateFields().then((values) => saveMutation.mutate(values)).catch(() => {})}
          >
            保存配置
          </Button>
        </Space>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message="未启用时继续使用服务器本地存储，启用后新上传文件写入 TOS"
        description={config?.hasAccessKeySecret
          ? 'Secret Access Key 已加密保存且不会回显；密码框留空会保留当前值。历史本地文件不会自动迁移。'
          : '你可以先保存 Bucket、地域等资源信息，稍后再补充密钥并启用。'}
      />

      <Alert
        type="warning"
        showIcon
        style={{ marginBottom: 20 }}
        message="若为 Bucket 配置了生命周期规则，请评估自动删除对路演素材的影响"
        description="低频存储期间文件仍可读取；对象被生命周期删除后，管理端会在预览或下载前通过 HeadObject 检查对象是否存在，并将失效素材标记为“已被生命周期清理”，不会再访问数据库中残留的原始地址。"
      />

      {config?.secretUnreadable && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 20 }}
          message="已保存的 Secret Access Key 无法读取，请重新填写"
          description="后端无法解密当前保存的密钥（通常由加密密钥轮换或配置迁移导致）。在重新填写并保存 Secret 之前，TOS 直传与测试连接会失败。"
        />
      )}

      <Form form={form} layout="vertical" requiredMark="optional">
        <Card title="服务与资源" style={{ marginBottom: 20 }}>
          <Row gutter={[20, 0]}>
            <Col xs={24} md={8}>
              <Form.Item label="服务商">
                <Input value="字节火山引擎 TOS" disabled />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="enabled" label="上传存储" valuePropName="checked">
                <Switch checkedChildren="TOS" unCheckedChildren="本地" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item label="Secret 状态">
                <Tag color={config?.secretUnreadable ? 'error' : config?.hasAccessKeySecret ? 'success' : 'warning'}>
                  {config?.secretUnreadable ? '需重新填写' : config?.hasAccessKeySecret ? '已安全保存' : '未配置'}
                </Tag>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[20, 0]}>
            <Col xs={24} lg={12}>
              <Form.Item name="region" label="Region" rules={[{ required: true, message: '请输入 Bucket 所在地域' }]}>
                <Input placeholder="cn-beijing" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="endpoint"
                label="Endpoint"
                rules={[{ required: true, message: '请输入访问域名' }]}
                extra="填写地域对应的公网或内网访问域名，不包含 Bucket 名"
              >
                <Input placeholder="tos-cn-beijing.volces.com" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={[20, 0]}>
            <Col xs={24} lg={12}>
              <Form.Item name="bucket" label="Bucket">
                <Input placeholder="你的存储桶名称" />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="keyPrefix"
                label="对象路径前缀"
                extra="留空时直接使用桶根目录；系统会按场次与资源类型（roadshow-audio / roadshow-review-video）分块保存"
              >
                <Input placeholder="留空则从 roadshow 开始" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="publicBaseUrl"
            label="公开访问根地址 / CDN 域名（可选）"
            extra="留空时使用 https://{bucket}.{endpoint}；现有客户端需要能够直接访问返回的文件 URL"
            rules={[{ type: 'url', message: '请输入完整的 HTTP(S) URL' }]}
          >
            <Input placeholder="https://static.example.com" />
          </Form.Item>
        </Card>

        <Card title="路演音视频文件命名" style={{ marginBottom: 20 }}>
          <Form.Item
            name="roadshowMediaNameTemplate"
            label="对象名模板"
            extra="音频和审核视频共用此模板；系统会清洗特殊字符，并在模板未包含 {random} 时自动追加 8 位随机编号，避免重复上传覆盖"
            rules={[
              { required: true, message: '请输入路演音视频对象名模板' },
              {
                validator: async (_: unknown, value: string) => {
                  const allowed = ALLOWED_ROADSHOW_MEDIA_NAME_TOKENS;
                  const placeholders: string[] = value?.match(/\{([^{}]+)\}/g) || [];
                  const unsupported = placeholders.find((placeholder) => !allowed.has(placeholder.slice(1, -1)));
                  if (unsupported) throw new Error(`命名变量不支持：${unsupported}`);
                },
              },
            ]}
          >
            <Input placeholder={DEFAULT_ROADSHOW_MEDIA_NAME_TEMPLATE} />
          </Form.Item>
          <Space wrap>
            {ROADSHOW_MEDIA_NAME_VARIABLES.map((item) => (
              <Tag key={item.token} color="blue">
                {'{' + item.token + '}'} · {item.label}
              </Tag>
            ))}
          </Space>
          <div style={{ marginTop: 12 }}>
            <Text type="secondary">
              示例：{DEFAULT_ROADSHOW_MEDIA_NAME_TEMPLATE} 生成 <code>123_歌曲名_组名_a1b2c3d4.mp3</code>；
              模板中变量以外的文字会作为静态名称保留。
            </Text>
          </div>
        </Card>

        <Card title="访问凭证" style={{ marginBottom: 20 }}>
          <Row gutter={[20, 0]}>
            <Col xs={24} lg={12}>
              <Form.Item name="accessKeyId" label="AccessKey ID">
                <Input autoComplete="off" placeholder="AKLT..." />
              </Form.Item>
            </Col>
            <Col xs={24} lg={12}>
              <Form.Item
                name="accessKeySecret"
                label="Secret Access Key"
                rules={config?.secretUnreadable
                  ? [{ required: true, message: '已保存的 Secret 无法读取，请重新填写' }]
                  : undefined}
                extra={config?.secretUnreadable
                  ? '检测到已保存的 Secret 无法解密，必须重新填写后才能启用 TOS'
                  : config?.hasAccessKeySecret ? '留空则保留当前 Secret' : '启用 TOS 前必须填写'}
              >
                <Input.Password
                  autoComplete="new-password"
                  placeholder={config?.hasAccessKeySecret ? '已配置，留空不修改' : '请输入 Secret Access Key'}
                />
              </Form.Item>
            </Col>
          </Row>
          <Alert
            type="warning"
            showIcon
            message="建议使用最小权限 IAM 子用户密钥"
            description="运行账号至少需要目标 Bucket 的 HeadBucket、HeadObject 与 PutObject 权限；清理受管对象还需要 DeleteObject。不要把长期 AK/SK 配置到浏览器或 VITE_ 环境变量。"
          />
        </Card>

        <Card title="接入说明">
          <Descriptions column={1} size="small">
            <Descriptions.Item label="上传方式">普通上传经服务端官方 Node.js SDK 的 PutObject 写入；路演音视频走客户端预签名 PUT 直传（30 分钟有效）</Descriptions.Item>
            <Descriptions.Item label="文件命名">普通上传使用 UUID；路演音视频使用上方模板并追加防覆盖随机编号</Descriptions.Item>
            <Descriptions.Item label="切换范围">POST /upload 通用上传，以及路演音频 / 审核视频直传接口</Descriptions.Item>
            <Descriptions.Item label="直传前置">预签名直传依赖桶侧 CORS 放行 PUT 与对应 Content-Type，请先在 TOS 控制台配置跨域规则</Descriptions.Item>
            <Descriptions.Item label="失效处理">预览和下载前通过 HeadObject 校验；生命周期删除的对象不再签发读取地址</Descriptions.Item>
            <Descriptions.Item label="官方文档">
              <Link href="https://docs.volcengine.com/docs/6349/93480?lang=zh" target="_blank" rel="noreferrer">
                TOS Node.js SDK 使用文档
              </Link>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Form>
    </div>
  );
}
