import { Alert, Button, Card, Col, Descriptions, Empty, Modal, Row, Space, Spin, Statistic, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, ClockCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  cancelRoadshowPosition,
  getRoadshowPositions,
  selectRoadshowPosition,
} from '../../../services/roadshow-position';
import type { RoadshowPositionBoard, RoadshowPositionItem, RoadshowPositionSection } from '../../../types/roadshow';
import type { ApiResponse } from '../../../types/api';

const { Title, Text } = Typography;

export default function RoadshowPositionPage() {
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const registrationId = Number(params.id);
  const queryKey = ['roadshow-positions', registrationId];

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey,
    queryFn: () => getRoadshowPositions(registrationId),
    enabled: Number.isInteger(registrationId) && registrationId > 0,
    refetchInterval: 5_000,
    // 可见性暂停：页面切到后台时停止轮询，降低开放瞬间的读压力
    refetchIntervalInBackground: false,
  });
  const board = (data as unknown as ApiResponse<RoadshowPositionBoard> | undefined)?.data;

  const selectMutation = useMutation({
    mutationFn: (positionId: number) => selectRoadshowPosition(registrationId, positionId),
    onSuccess: () => {
      message.success('位次已锁定');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (mutationError: Error) => {
      message.error(mutationError.message || '选位失败，请刷新后重试');
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelRoadshowPosition(registrationId),
    onSuccess: () => {
      message.success('已取消选位，位次已释放');
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (mutationError: Error) => {
      message.error(mutationError.message || '取消失败，请刷新后重试');
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const confirmSelect = (position: RoadshowPositionItem) => {
    Modal.confirm({
      title: `确认选择“${position.label}”？`,
      content: (
        <div>
          <div>参考时间：{formatTime(position.reference_time)}</div>
          {position.reference_time_only && (
            <div style={{ color: '#d46b08', marginTop: 8 }}>中场时间会随现场进度变化，仅供参考。</div>
          )}
          <div style={{ marginTop: 8 }}>确认后该位次将立即锁定；需要更换时请先取消。</div>
        </div>
      ),
      okText: '确认锁定位次',
      cancelText: '再看看',
      onOk: () => selectMutation.mutateAsync(position.id),
    });
  };

  const confirmCancel = () => {
    Modal.confirm({
      title: '确认取消当前位次？',
      content: '取消后该位次会立即释放，其他用户可以选择。',
      okText: '确认取消',
      okButtonProps: { danger: true },
      cancelText: '保留位次',
      onOk: () => cancelMutation.mutateAsync(),
    });
  };

  if (!Number.isInteger(registrationId) || registrationId <= 0) {
    return (
      <div className="rd-page-shell" style={{ padding: '32px 0' }}>
        <div className="rd-container"><Empty description="报名 ID 无效" /></div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rd-page-shell" style={{ padding: '80px 0', textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="rd-page-shell" style={{ padding: '32px 0' }}>
        <div className="rd-container" style={{ maxWidth: 900, margin: '0 auto' }}>
          <Alert type="error" showIcon message="无法加载选位信息" description={(error as Error)?.message} />
          <Button style={{ marginTop: 16 }} icon={<ArrowLeftOutlined />} onClick={() => navigate('/roadshow/mine')}>返回我的报名</Button>
        </div>
      </div>
    );
  }

  const regularPositions = board.positions.filter((position) => position.section === 'regular');
  const halftimePositions = board.positions.filter((position) => position.section === 'halftime');

  return (
    <div className="rd-page-shell" style={{ padding: '32px 0 48px' }}>
      <div className="rd-container" style={{ maxWidth: 1100, margin: '0 auto' }}>
        <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 20 }} wrap>
          <div>
            <Title level={2} style={{ margin: 0 }}>路演位次选择</Title>
            <Text type="secondary">{board.session.name} · {board.registration.group_name}</Text>
          </div>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/roadshow/mine')}>我的报名</Button>
            <Button icon={<ReloadOutlined spin={isFetching} />} onClick={() => refetch()}>刷新状态</Button>
          </Space>
        </Space>

        <Alert
          type={board.selection_state === 'open' ? 'success' : 'info'}
          showIcon
          message={board.selection_state_message}
          description={board.selection_state === 'not_open' && board.session.selection_open_at
            ? `开放时间：${dayjs(board.session.selection_open_at).format('YYYY-MM-DD HH:mm:ss')}`
            : undefined}
          style={{ marginBottom: 18 }}
        />

        {!board.registration.eligible && (
          <Alert
            type="warning"
            showIcon
            message="当前报名暂不可选位"
            description="只有审核状态为“已通过”的报名可以选择路演位次。"
            style={{ marginBottom: 18 }}
          />
        )}

        <Card className="rd-glass-card" style={{ marginBottom: 18, borderRadius: 20 }}>
          <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} size="small">
            <Descriptions.Item label="活动开始">{dayjs(board.session.event_date).format('YYYY-MM-DD HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="活动地点">{board.session.location}</Descriptions.Item>
            <Descriptions.Item label="每组时长">{board.session.slot_minutes} 分钟</Descriptions.Item>
            <Descriptions.Item label="节目">{board.registration.artist_name} - {board.registration.song_name}</Descriptions.Item>
            <Descriptions.Item label="已通过组数">{board.capacity.approved_registration_count} 组</Descriptions.Item>
            <Descriptions.Item label="冗余位">普通 +{board.capacity.reserve_count} / 中场 +{board.capacity.reserve_count}</Descriptions.Item>
            <Descriptions.Item label="状态同步">{dayjs(board.server_time).format('HH:mm:ss')}</Descriptions.Item>
          </Descriptions>
        </Card>

        {board.current_selection && (
          <Card
            style={{ marginBottom: 20, borderColor: '#52c41a', borderRadius: 20 }}
            title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} />已锁定位次</Space>}
            extra={<Button danger loading={cancelMutation.isPending} onClick={confirmCancel}>取消选位</Button>}
          >
            <Space size={20} wrap>
              <Tag color="success" style={{ fontSize: 16, padding: '6px 12px' }}>{board.current_selection.label}</Tag>
              <Statistic
                title={board.current_selection.reference_time_only ? '参考时间（仅供参考）' : '预计时间'}
                value={formatTime(board.current_selection.reference_time)}
                prefix={<ClockCircleOutlined />}
              />
            </Space>
          </Card>
        )}

        {board.positions.length > 0 && (
          <>
            <PositionSection
              title="普通路演位"
              description={`从活动开始时间起，每 ${board.session.slot_minutes} 分钟一组；新增位次追加在普通路演末尾。`}
              section="regular"
              positions={regularPositions}
              hasSelection={!!board.current_selection}
              selectionAllowed={board.selection_state === 'open' && board.registration.eligible}
              loading={selectMutation.isPending}
              onSelect={confirmSelect}
            />
            <PositionSection
              title="中场路演位"
              description={`按已通过的实际路演组数计算，不包含冗余位；默认延后 ${board.session.halftime_delay_minutes} 分钟开始，所有时间仅供参考。`}
              section="halftime"
              positions={halftimePositions}
              hasSelection={!!board.current_selection}
              selectionAllowed={board.selection_state === 'open' && board.registration.eligible}
              loading={selectMutation.isPending}
              onSelect={confirmSelect}
            />
          </>
        )}

        {board.positions.length === 0 && (
          <Empty description={board.selection_state === 'cancelled' ? '场次已取消，暂无可选位次' : '暂无可选位次'} />
        )}
      </div>
    </div>
  );
}

function PositionSection({
  title,
  description,
  section,
  positions,
  hasSelection,
  selectionAllowed,
  loading,
  onSelect,
}: {
  title: string;
  description: string;
  section: RoadshowPositionSection;
  positions: RoadshowPositionItem[];
  hasSelection: boolean;
  selectionAllowed: boolean;
  loading: boolean;
  onSelect: (position: RoadshowPositionItem) => void;
}) {
  return (
    <Card title={title} style={{ marginBottom: 18, borderRadius: 20 }} extra={<Text type="secondary">{positions.length} 个位次</Text>}>
      <Alert
        type={section === 'halftime' ? 'warning' : 'info'}
        showIcon
        message={description}
        style={{ marginBottom: 16 }}
      />
      <Row gutter={[12, 12]}>
        {positions.map((position) => {
          const occupied = position.status === 'occupied';
          const mine = position.status === 'mine';
          return (
            <Col key={position.id} xs={12} sm={8} md={6} lg={4}>
              <Button
                block
                type={mine ? 'primary' : 'default'}
                disabled={!selectionAllowed || occupied || (hasSelection && !mine) || mine}
                loading={loading && !hasSelection}
                onClick={() => onSelect(position)}
                style={{ height: occupied ? 112 : 72, whiteSpace: 'normal', padding: '8px 10px' }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{position.label}</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    {occupied ? '已被选择' : mine ? '我的位次' : formatTime(position.reference_time)}
                  </div>
                  {occupied && position.occupant && (
                    <div style={{ marginTop: 5, fontSize: 12, lineHeight: 1.35 }}>
                      <div title={position.occupant.group_name} style={ellipsisStyle}>{position.occupant.group_name}</div>
                      <div
                        title={`${position.occupant.artist_name} - ${position.occupant.song_name}`}
                        style={{ ...ellipsisStyle, opacity: 0.75 }}
                      >
                        {position.occupant.artist_name} - {position.occupant.song_name}
                      </div>
                    </div>
                  )}
                </div>
              </Button>
            </Col>
          );
        })}
      </Row>
    </Card>
  );
}

const ellipsisStyle = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

function formatTime(value: string | null) {
  return value ? dayjs(value).format('MM-DD HH:mm') : '待定';
}
