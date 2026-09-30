import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Progress, Select, Space, Spin, Typography, message } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getMyRegistrations } from '../../../services/registration';
import {
  completeRoadshowMediaUpload,
  createRoadshowMediaUpload,
  getRoadshowMedia,
  uploadFileToSignedUrl,
  uploadRoadshowMediaLocal,
} from '../../../services/roadshow';
import type { Registration, RoadshowMediaType } from '../../../types/roadshow';

const { Title, Text } = Typography;

const AUDIO_MAX_BYTES = 30 * 1024 * 1024;
const VIDEO_MAX_BYTES = 1024 * 1024 * 1024;

export default function RoadshowMediaUploadPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedRegistrationId = Number(searchParams.get('registration_id')) || undefined;
  const [registrationId, setRegistrationId] = useState<number | undefined>(requestedRegistrationId);
  const [files, setFiles] = useState<Partial<Record<RoadshowMediaType, File>>>({});
  const [uploading, setUploading] = useState<RoadshowMediaType>();
  const [progress, setProgress] = useState(0);

  // 文件选择框 ref（成功/失败后重置 value，避免选同一文件不触发 change）。
  const audioInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const inputRefs = { audio: audioInputRef, 'review-video': videoInputRef };
  // 直传中断句柄与挂载标记：卸载时 abort，避免对已卸载组件 setState。
  const abortRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.();
      abortRef.current = null;
    };
  }, []);

  const registrationsQuery = useQuery({
    queryKey: ['my-registrations', 'media-upload'],
    queryFn: () => getMyRegistrations({ page: 1, page_size: 100 }),
  });
  const registrations = useMemo<Registration[]>(
    () => registrationsQuery.data?.data?.list || [],
    [registrationsQuery.data],
  );
  const activeRegistrationId = registrationId ?? registrations[0]?.id;
  const activeRegistration = registrations.find((item) => item.id === activeRegistrationId);
  // 后端约束：仅“已驳回”的报名禁止补充/更换素材，待审核与已通过均可上传。
  const canUpload = !!activeRegistration && activeRegistration.status !== 'rejected';

  const mediaQuery = useQuery({
    queryKey: ['roadshow-media', activeRegistrationId],
    queryFn: () => getRoadshowMedia(activeRegistrationId!),
    enabled: !!activeRegistrationId,
  });
  const media = mediaQuery.data?.data;

  const upload = async (type: RoadshowMediaType) => {
    const file = files[type];
    if (!activeRegistrationId || !file) return;
    if (!canUpload) {
      message.warning('已驳回的报名不能补充或更换素材');
      return;
    }
    const max = type === 'audio' ? AUDIO_MAX_BYTES : VIDEO_MAX_BYTES;
    if (file.size > max) {
      message.error(type === 'audio' ? '音频不能超过 30MB' : '审核视频不能超过 1GB');
      return;
    }
    setUploading(type);
    setProgress(0);
    const resetInput = () => {
      const input = inputRefs[type].current;
      if (input) input.value = '';
    };
    const reportProgress = (percent: number) => {
      if (mountedRef.current) setProgress(percent);
    };
    try {
      // 先取上传票据，按 mode 分支：direct 走预签名 PUT + complete；local 走 multipart 回退。
      const ticket = await createRoadshowMediaUpload(activeRegistrationId, type, file);
      if (ticket.data.mode === 'direct') {
        const handle = uploadFileToSignedUrl(
          ticket.data.upload_url,
          file,
          ticket.data.headers,
          reportProgress,
        );
        abortRef.current = handle.abort;
        await handle.promise;
        abortRef.current = null;
        await completeRoadshowMediaUpload(activeRegistrationId, type, ticket.data.object_key);
      } else {
        await uploadRoadshowMediaLocal(activeRegistrationId, type, file, reportProgress);
      }
      if (!mountedRef.current) return;
      message.success(`${type === 'audio' ? '音频' : '审核视频'}上传成功`);
      setFiles((value) => ({ ...value, [type]: undefined }));
      resetInput();
      await queryClient.invalidateQueries({ queryKey: ['roadshow-media', activeRegistrationId] });
      await queryClient.invalidateQueries({ queryKey: ['my-registrations'] });
    } catch (error) {
      if (!mountedRef.current) return;
      message.error(error instanceof Error ? error.message : '上传失败');
      resetInput();
    } finally {
      abortRef.current = null;
      if (mountedRef.current) setUploading(undefined);
    }
  };

  const mediaCard = (type: RoadshowMediaType, title: string, accept: string, hint: string) => {
    const state = type === 'audio' ? media?.audio : media?.review_video;
    return (
      <Card title={title} style={{ flex: 1, minWidth: 300, borderRadius: 20 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">{hint}</Text>
          <input
            ref={inputRefs[type]}
            type="file"
            accept={accept}
            disabled={!!uploading || !canUpload}
            onChange={(event) => setFiles((value) => ({ ...value, [type]: event.target.files?.[0] }))}
          />
          {files[type] && (
            <Text>{files[type]!.name}（{(files[type]!.size / 1024 / 1024).toFixed(1)}MB）</Text>
          )}
          {uploading === type && <Progress percent={progress} status="active" />}
          <Button
            type="primary"
            disabled={!files[type] || !!uploading || !canUpload}
            loading={uploading === type}
            onClick={() => upload(type)}
          >
            上传
          </Button>
          {state?.uploaded && (
            <Alert
              type={state.enabled ? 'success' : 'warning'}
              showIcon
              message={state.enabled ? '已上传并开放' : '已上传，但管理员已关闭'}
              action={(() => {
                // unmanaged 素材无签名 access_url，回退到数据库原始外链供查看。
                const viewUrl = state.access_url
                  ?? (state.availability === 'unmanaged' ? state.url : undefined);
                return viewUrl
                  ? <Button type="link" href={viewUrl} target="_blank" rel="noreferrer">查看/下载</Button>
                  : undefined;
              })()}
            />
          )}
        </Space>
      </Card>
    );
  };

  if (registrationsQuery.isLoading) {
    return (
      <div className="rd-page-shell" style={{ padding: '80px 0', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="rd-page-shell" style={{ padding: '32px 0 48px' }}>
      <div className="rd-container" style={{ maxWidth: 1000, margin: '0 auto' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
          <Title level={2} style={{ margin: 0 }}>补充 / 更换路演素材</Title>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/roadshow/mine')}>我的报名</Button>
        </Space>

        <Alert
          showIcon
          type="info"
          style={{ marginBottom: 20 }}
          message="待审核和已通过的报名均可补充或更换素材；音频与审核视频通过预签名地址直传对象存储。"
          description="上传音频会自动把音乐类型标记为“自剪”。已驳回的报名无法继续上传。"
        />

        {registrations.length === 0 ? (
          <Empty description="暂无可上传素材的报名">
            <Button type="primary" onClick={() => navigate('/roadshow/create')}>去报名</Button>
          </Empty>
        ) : (
          <>
            <Select
              style={{ width: '100%', marginBottom: 20 }}
              loading={registrationsQuery.isLoading}
              value={activeRegistrationId}
              onChange={(value) => {
                setRegistrationId(value);
                // 同步写回 URL（replace），保证刷新/分享链接与当前选中报名一致。
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set('registration_id', String(value));
                  return next;
                }, { replace: true });
              }}
              placeholder="请选择对应路演报名"
              options={registrations.map((item) => ({
                value: item.id,
                label: `#${item.id} ${item.session_name}｜${item.group_name}｜${item.artist_name}-${item.song_name}${item.status === 'rejected' ? '（已驳回）' : ''}`,
                disabled: item.status === 'rejected',
              }))}
            />
            {activeRegistration && !canUpload && (
              <Alert type="warning" showIcon style={{ marginBottom: 20 }} message="该报名已驳回，不能继续上传素材" />
            )}
            {media?.video_upload_enabled === false ? (
              // 对象存储未启用：隐藏审核视频上传入口，仅保留音频上传，并给出说明。
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {mediaCard('audio', '路演音频', '.mp3,.m4a,.wav,.flac,.aac,.ogg', '最大 30MB')}
                <Alert
                  type="warning"
                  showIcon
                  message="审核视频上传暂未开放"
                  description="平台尚未启用对象存储，为避免占用服务器空间，审核视频上传已关闭；音频上传不受影响。"
                />
              </Space>
            ) : (
              // video_upload_enabled 为 true 或 undefined（旧后端）时按允许处理，保持向后兼容。
              <Space align="start" wrap style={{ width: '100%' }}>
                {mediaCard('audio', '路演音频', '.mp3,.m4a,.wav,.flac,.aac,.ogg', '最大 30MB')}
                {mediaCard('review-video', '审核视频', '.mp4,.mov,.m4v,.webm', '最大 1GB')}
              </Space>
            )}
          </>
        )}
      </div>
    </div>
  );
}
