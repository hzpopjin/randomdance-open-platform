import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  InputNumber,
  Modal,
  Popover,
  Row,
  Segmented,
  Select,
  Space,
  Spin,
  Statistic,
  Switch,
  Tag,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  AppstoreOutlined,
  BarsOutlined,
  CalendarOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  HolderOutlined,
  LockOutlined,
  ReloadOutlined,
  SwapOutlined,
  TeamOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { getSessions, updateSession } from '../../../services/sessions';
import { getRoadshowArrangement, saveRoadshowArrangement } from '../../../services/roadshow';
import type {
  RoadshowArrangement,
  RoadshowArrangementRegistration,
  RoadshowPositionSection,
} from '../../../types/roadshow';
import type { Session } from '../../../types/session';
import {
  calculateProjectedCapacity,
  calculateRoadshowPositionMinuteOffset,
  moveOrSwapFixedPosition,
  placeAtPosition,
  reflowSection,
  sortByPosition,
  updateArrangementDraft,
} from '../../../utils/roadshowArrangement';

const { Text, Title } = Typography;

interface ArrangementEntry extends RoadshowArrangementRegistration {
  section: RoadshowPositionSection;
  position_no: number;
  original_position: number | null;
  locked: boolean;
}

interface SelectionConfigDraft {
  sessionId: number;
  enabled: boolean;
  openAt: dayjs.Dayjs | null;
}

type ArrangementView = 'board' | 'list';

function buildInitialEntries(arrangement: RoadshowArrangement) {
  const assigned: ArrangementEntry[] = arrangement.positions
    // 据实过滤：只保留状态为已通过的组进入编排（后端编排视图已返回 status）。
    .filter((position) => position.registration && position.registration.status === 'approved')
    .map((position) => ({
      ...position.registration!,
      section: position.section,
      position_no: position.position_no,
      original_position: position.position_no,
      locked: position.locked,
    }));
  const usedRegular = new Set(
    assigned.filter((entry) => entry.section === 'regular').map((entry) => entry.position_no),
  );
  const freeRegular = Array.from(
    { length: arrangement.counts.regular_position_count },
    (_, index) => index + 1,
  ).filter((positionNo) => !usedRegular.has(positionNo));
  const unassigned = arrangement.unassigned_registrations.map((registration, index) => ({
    ...registration,
    section: 'regular' as const,
    position_no: freeRegular[index],
    original_position: null,
    locked: false,
  }));
  return [...assigned, ...unassigned];
}

export default function RoadshowArrangementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const querySessionId = Number(searchParams.get('session_id')) || undefined;
  const [selectedSessionId, setSelectedSessionId] = useState<number | undefined>(querySessionId);
  const [editingEntries, setEditingEntries] = useState<ArrangementEntry[] | null>(null);
  const [draftAssignedIds, setDraftAssignedIds] = useState<Set<number>>(new Set());
  // 独立记录本次草稿中被撤回（移回待分配区）的组，覆盖 isAssigned 判定。
  const [draftUnassignedIds, setDraftUnassignedIds] = useState<Set<number>>(new Set());
  // 保存冲突时高亮报错组（按后端返回的「第 N 组」定位）。
  const [highlightPositionNo, setHighlightPositionNo] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ArrangementView>('board');
  const [dirty, setDirty] = useState(false);
  const [selectionConfigDraft, setSelectionConfigDraft] = useState<SelectionConfigDraft | null>(null);
  const [selectionSettingsOpen, setSelectionSettingsOpen] = useState(false);

  const { data: sessionsResponse, isLoading: sessionsLoading } = useQuery({
    queryKey: ['sessions', 'roadshow-arrangement'],
    queryFn: () => getSessions({ page: 1, page_size: 100 }),
  });
  const sessions: Session[] = useMemo(
    () => sessionsResponse?.data?.list || [],
    [sessionsResponse],
  );
  const sessionId = selectedSessionId ?? sessions[0]?.id;
  const selectedSession = sessions.find((session) => session.id === sessionId);
  const activeSelectionDraft = selectionConfigDraft?.sessionId === sessionId
    ? selectionConfigDraft
    : null;
  const selectionEnabled = activeSelectionDraft?.enabled
    ?? !!selectedSession?.roadshow_selection_enabled;
  const selectionOpenAt = activeSelectionDraft
    ? activeSelectionDraft.openAt
    : selectedSession?.roadshow_selection_open_at
      ? dayjs(selectedSession.roadshow_selection_open_at)
      : null;
  const selectionConfigDirty = !!activeSelectionDraft;

  const changeSelectionConfig = (change: Partial<Pick<SelectionConfigDraft, 'enabled' | 'openAt'>>) => {
    if (!sessionId) return;
    setSelectionConfigDraft({
      sessionId,
      enabled: selectionEnabled,
      openAt: selectionOpenAt,
      ...change,
    });
  };

  const { data: arrangementResponse, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['roadshow', 'arrangement', sessionId],
    queryFn: () => getRoadshowArrangement(sessionId!),
    enabled: !!sessionId,
    refetchInterval: dirty ? false : 10_000,
    refetchIntervalInBackground: false,
  });
  const arrangement = arrangementResponse?.data;

  const baseEntries = useMemo(
    () => (arrangement ? buildInitialEntries(arrangement) : []),
    [arrangement],
  );
  const entries = editingEntries ?? baseEntries;

  const isAssigned = (entry: ArrangementEntry) =>
    (entry.original_position !== null || draftAssignedIds.has(entry.id))
    && !draftUnassignedIds.has(entry.id);
  const assignedEntries = entries.filter(isAssigned);
  const unassignedEntries = entries.filter((entry) => !isAssigned(entry));
  const regularEntries = sortByPosition(assignedEntries.filter((entry) => entry.section === 'regular'));
  const halftimeEntries = sortByPosition(assignedEntries.filter((entry) => entry.section === 'halftime'));

  const regularProjectedCapacity = Math.max(
    arrangement?.counts.regular_position_count || 0,
    calculateProjectedCapacity(regularEntries, arrangement?.counts.reserve_count || 0),
  );
  const halftimeProjectedCapacity = Math.max(
    arrangement?.counts.halftime_position_count || 0,
    calculateProjectedCapacity(halftimeEntries, arrangement?.counts.reserve_count || 0),
  );
  const regularTimelineGroupCount = regularEntries.length + unassignedEntries.length;

  const capacityFor = (section: RoadshowPositionSection) => section === 'regular'
    ? regularProjectedCapacity
    : halftimeProjectedCapacity;

  const replaceSections = (
    regular: ArrangementEntry[],
    halftime: ArrangementEntry[],
  ) => {
    setEditingEntries([...sortByPosition(regular), ...sortByPosition(halftime), ...unassignedEntries]);
    setDirty(true);
  };

  const assignToPosition = (
    entryId: number,
    section: RoadshowPositionSection,
    positionNo: number,
  ) => {
    const occupied = (section === 'regular' ? regularEntries : halftimeEntries)
      .some((entry) => entry.position_no === positionNo);
    if (occupied) {
      message.warning('该位次已有路演组，请选择空位');
      return;
    }
    setEditingEntries((current) => updateArrangementDraft(current, entries, (draft) =>
      draft.map((entry) => entry.id === entryId
        ? { ...entry, section, position_no: positionNo, locked: false }
        : entry),
    ));
    setDraftAssignedIds((current) => new Set(current).add(entryId));
    setDraftUnassignedIds((current) => {
      if (!current.has(entryId)) return current;
      const next = new Set(current);
      next.delete(entryId);
      return next;
    });
    setDirty(true);
  };

  const returnToUnassigned = (entryId: number) => {
    const entry = entries.find((item) => item.id === entryId);
    // 允许原已选位（original_position !== null）的组被撤回，锁定组除外。
    if (!entry || entry.locked) return;
    setDraftAssignedIds((current) => {
      const next = new Set(current);
      next.delete(entryId);
      return next;
    });
    // 用独立的 draftUnassignedIds 覆盖 isAssigned 判定，将其移回待分配区。
    setDraftUnassignedIds((current) => new Set(current).add(entryId));
    setEditingEntries((current) => updateArrangementDraft(current, entries, (draft) =>
      draft.map((item) => item.id === entryId
        ? { ...item, locked: false }
        : item),
    ));
    setHighlightPositionNo(null);
    setDirty(true);
  };

  const autoAssignUnassigned = () => {
    const occupied = new Set(regularEntries.map((entry) => entry.position_no));
    const free = Array.from({ length: regularProjectedCapacity }, (_, index) => index + 1)
      .filter((positionNo) => !occupied.has(positionNo));
    if (free.length < unassignedEntries.length) {
      message.warning('当前普通位不足，请先调整已有编排');
      return;
    }
    const assignments = new Map(unassignedEntries.map((entry, index) => [entry.id, free[index]]));
    setEditingEntries((current) => updateArrangementDraft(current, entries, (draft) =>
      draft.map((entry) => assignments.has(entry.id)
        ? { ...entry, section: 'regular', position_no: assignments.get(entry.id)!, locked: false }
        : entry),
    ));
    setDraftAssignedIds((current) => new Set([...current, ...unassignedEntries.map((entry) => entry.id)]));
    setDraftUnassignedIds((current) => {
      const next = new Set(current);
      unassignedEntries.forEach((entry) => next.delete(entry.id));
      return next;
    });
    setDirty(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => saveRoadshowArrangement(sessionId!, {
      expected_version: arrangement!.version,
      items: [...regularEntries, ...halftimeEntries].map((entry) => ({
        registration_id: entry.id,
        section: entry.section,
        position_no: entry.position_no,
        locked: entry.locked,
      })),
    }),
    onSuccess: (response) => {
      message.success('路演编排已保存，选位、锁定与导出顺序已同步');
      queryClient.setQueryData(['roadshow', 'arrangement', sessionId], response);
      queryClient.invalidateQueries({ queryKey: ['roadshow'] });
      setDraftAssignedIds(new Set());
      setDraftUnassignedIds(new Set());
      setHighlightPositionNo(null);
      setEditingEntries(null);
      setDirty(false);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : '保存失败，请刷新后重试';
      // 区分错误类型：expected_version 版本冲突才提示刷新并丢弃草稿；
      // 其余业务校验冲突（已通过组数变化 / 锁定 / 位次不足）保留草稿并高亮报错组。
      const isVersionConflict = /已被其他用户或管理员更新/.test(msg);
      if (isVersionConflict) {
        message.error('路演位次已被其他用户或管理员更新，请刷新后重试');
        setDraftAssignedIds(new Set());
        setDraftUnassignedIds(new Set());
        setHighlightPositionNo(null);
        setEditingEntries(null);
        setDirty(false);
        refetch();
        return;
      }
      message.error(msg);
      const matched = msg.match(/第\s*(\d+)\s*组/);
      setHighlightPositionNo(matched ? Number(matched[1]) : null);
    },
  });

  const selectionConfigMutation = useMutation({
    mutationFn: () => updateSession(sessionId!, {
      roadshow_selection_enabled: selectionEnabled,
      roadshow_selection_open_at: selectionOpenAt
        ? selectionOpenAt.format('YYYY-MM-DD HH:mm:ss')
        : null,
    }),
    onSuccess: (response) => {
      message.success('选位开放设置已保存');
      queryClient.setQueryData(
        ['sessions', 'roadshow-arrangement'],
        (current: typeof sessionsResponse) => current ? ({
          ...current,
          data: {
            ...current.data,
            list: current.data.list.map((session) => session.id === sessionId
              ? response.data
              : session),
          },
        }) : current,
      );
      setSelectionConfigDraft(null);
      setSelectionSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      queryClient.invalidateQueries({ queryKey: ['roadshow', 'arrangement', sessionId] });
    },
    onError: (error) => {
      message.error(error instanceof Error ? error.message : '开放设置保存失败');
    },
  });

  const move = (section: RoadshowPositionSection, entryId: number, direction: -1 | 1) => {
    const sectionEntries = section === 'regular' ? regularEntries : halftimeEntries;
    const source = sectionEntries.find((entry) => entry.id === entryId);
    if (!source || source.locked) return;
    const unlocked = sectionEntries.filter((entry) => !entry.locked);
    const index = unlocked.findIndex((entry) => entry.id === entryId);
    const target = index + direction;
    if (target < 0 || target >= unlocked.length) return;
    [unlocked[index], unlocked[target]] = [unlocked[target], unlocked[index]];
    const nextSection = reflowSection(sectionEntries, capacityFor(section), unlocked.map((entry) => entry.id));
    replaceSections(
      section === 'regular' ? nextSection : regularEntries,
      section === 'halftime' ? nextSection : halftimeEntries,
    );
  };

  const moveToPosition = (
    entryId: number,
    section: RoadshowPositionSection,
    requestedPosition: number,
  ) => {
    const sectionEntries = section === 'regular' ? regularEntries : halftimeEntries;
    const result = placeAtPosition(sectionEntries, entryId, requestedPosition, capacityFor(section));
    if (result.actualPosition === null) return;
    if (result.actualPosition !== requestedPosition) {
      message.info(`第 ${requestedPosition} 组不可用，已自动跳过锁定位并调整为第 ${result.actualPosition} 组`);
    }
    replaceSections(
      section === 'regular' ? result.entries : regularEntries,
      section === 'halftime' ? result.entries : halftimeEntries,
    );
  };

  const relocate = (
    entryId: number,
    targetSection: RoadshowPositionSection,
    targetPosition?: number,
  ) => {
    const source = entries.find((entry) => entry.id === entryId);
    if (!source || source.locked || !arrangement) return;
    if (!isAssigned(source)) {
      assignToPosition(entryId, targetSection, targetPosition || 1);
      return;
    }
    if (source.section === targetSection) {
      moveToPosition(entryId, targetSection, targetPosition || source.position_no);
      return;
    }

    const targetEntries = targetSection === 'regular' ? regularEntries : halftimeEntries;
    const targetCapacity = capacityFor(targetSection);
    if (targetEntries.length >= targetCapacity) {
      message.warning(targetSection === 'halftime' ? '中场位次已满' : '普通位次已满');
      return;
    }

    const sourceEntries = source.section === 'regular' ? regularEntries : halftimeEntries;
    const sourceRemaining = sourceEntries.filter((entry) => entry.id !== entryId);
    const nextSource = reflowSection(sourceRemaining, capacityFor(source.section));
    const moved = { ...source, section: targetSection, locked: false, position_no: targetEntries.length + 1 };
    const targetWithMoved = reflowSection(
      [...targetEntries, moved],
      targetCapacity,
      [...targetEntries.filter((entry) => !entry.locked).map((entry) => entry.id), moved.id],
    );
    const placed = placeAtPosition(
      targetWithMoved,
      moved.id,
      targetPosition || targetEntries.length + 1,
      targetCapacity,
    ).entries;
    replaceSections(
      targetSection === 'regular' ? placed : nextSource,
      targetSection === 'halftime' ? placed : nextSource,
    );
  };

  const toggleLock = (entryId: number) => {
    setEditingEntries(entries.map((entry) => entry.id === entryId
      ? { ...entry, locked: !entry.locked }
      : entry));
    setDirty(true);
  };

  const handleDrop = (
    sourceId: number,
    targetSection: RoadshowPositionSection,
    targetPosition: number,
  ) => relocate(sourceId, targetSection, targetPosition);

  const handleBoardDrop = (
    sourceId: number,
    targetSection: RoadshowPositionSection,
    targetPosition: number,
  ) => {
    const source = entries.find((entry) => entry.id === sourceId);
    if (!source || source.locked) return;
    if (!isAssigned(source)) {
      assignToPosition(sourceId, targetSection, targetPosition);
      return;
    }

    const result = moveOrSwapFixedPosition(
      assignedEntries,
      sourceId,
      targetSection,
      targetPosition,
    );
    if (result.action === 'noop') return;
    if (result.action === 'blocked') {
      message.warning('目标位次已锁定，请先解锁再交换');
      return;
    }

    const updated = new Map(result.entries.map((entry) => [entry.id, entry]));
    setEditingEntries((current) => updateArrangementDraft(current, entries, (draft) =>
      draft.map((entry) => updated.get(entry.id) || entry),
    ));
    setDirty(true);
    message.success(result.action === 'swapped' ? '两个位次已交换' : '路演组已移动到空位');
  };

  const handleSessionChange = (value: number) => {
    const change = () => {
      setDirty(false);
      setSelectionConfigDraft(null);
      setSelectionSettingsOpen(false);
      setEditingEntries(null);
      setDraftAssignedIds(new Set());
      setDraftUnassignedIds(new Set());
      setHighlightPositionNo(null);
      setSelectedSessionId(value);
      setSearchParams({ session_id: String(value) });
    };
    if (!dirty && !selectionConfigDirty) return change();
    Modal.confirm({
      title: '放弃未保存的调整？',
      content: '切换场次后，当前编排或选位开放设置将不会保留。',
      onOk: change,
    });
  };

  const saveSelectionConfig = () => {
    if (!sessionId) return;
    if (selectionEnabled && !selectionOpenAt) {
      message.error('启用选位通道前，请先设置自动开放时间');
      return;
    }
    if (selectionEnabled && selectedSession && selectionOpenAt) {
      if (!selectionOpenAt.isBefore(dayjs(selectedSession.event_date))) {
        message.error('自动开放时间必须早于活动开始时间');
        return;
      }
    }
    selectionConfigMutation.mutate();
  };

  const confirmSave = () => {
    if (!arrangement) return;
    setHighlightPositionNo(null);
    Modal.confirm({
      title: '确认保存当前路演编排？',
      content: `保存后会立即同步到网页、APP、小程序和导出顺序；${unassignedEntries.length > 0 ? `${unassignedEntries.length} 组将继续保持未选位。` : '所有组均已分配位置。'}锁定组会保持当前序号。`,
      okText: '确认保存',
      onOk: () => saveMutation.mutate(),
    });
  };

  const sessionOptions = useMemo(() => sessions.map((session) => ({
    value: session.id,
    label: `${session.name} · ${dayjs(session.event_date).format('YYYY-MM-DD HH:mm')}`,
  })), [sessions]);

  if (sessionsLoading && sessions.length === 0) {
    return <div style={{ padding: 64, textAlign: 'center' }}><Spin /></div>;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>路演编排</Title>
          <Text type="secondary">拖拽排序、指定组数或锁定固定位置</Text>
        </div>
        <Space wrap>
          <Segmented
            value={viewMode}
            options={[
              { label: '位次看板', value: 'board', icon: <AppstoreOutlined /> },
              { label: '纵向编排', value: 'list', icon: <BarsOutlined /> },
            ]}
            onChange={(value) => setViewMode(value as ArrangementView)}
          />
          <Button onClick={() => navigate('/admin/roadshow')}>报名管理</Button>
          <Button icon={<ClockCircleOutlined />} disabled={!selectedSession} onClick={() => setSelectionSettingsOpen(true)}>
            开放设置
          </Button>
          <Button icon={<ReloadOutlined />} loading={isFetching} onClick={() => refetch()}>刷新状态</Button>
          <Button type="primary" icon={<CheckOutlined />} disabled={!dirty || !arrangement} loading={saveMutation.isPending} onClick={confirmSave}>
            保存编排
          </Button>
        </Space>
      </div>

      <Card size="small" style={{ marginBottom: 18 }}>
        <Space wrap size="middle">
          <CalendarOutlined />
          <Select
            showSearch
            optionFilterProp="label"
            value={sessionId}
            options={sessionOptions}
            onChange={handleSessionChange}
            loading={sessionsLoading}
            style={{ width: 360, maxWidth: '75vw' }}
            placeholder="选择场次"
          />
          {arrangement?.session.is_cancelled && <Tag color="error">已取消</Tag>}
          {arrangement && <Text type="secondary">{arrangement.session.location} · 每组 {arrangement.session.slot_minutes} 分钟</Text>}
        </Space>
      </Card>

      {selectedSession && (
        <Modal
          title={`选位开放设置 · ${selectedSession.name}`}
          open={selectionSettingsOpen}
          okText="保存设置"
          cancelText="取消"
          okButtonProps={{
            disabled: !selectionConfigDirty,
            loading: selectionConfigMutation.isPending,
          }}
          cancelButtonProps={{ disabled: selectionConfigMutation.isPending }}
          maskClosable={!selectionConfigMutation.isPending}
          closable={!selectionConfigMutation.isPending}
          onOk={saveSelectionConfig}
          onCancel={() => {
            setSelectionConfigDraft(null);
            setSelectionSettingsOpen(false);
          }}
        >
          <Alert
            showIcon
            type={selectedSession.is_cancelled
              ? 'error'
              : !selectionEnabled
                ? 'warning'
                : selectionOpenAt && !dayjs().isBefore(selectionOpenAt)
                  ? 'success'
                  : 'info'}
            message={selectedSession.is_cancelled
              ? '场次已取消'
              : !selectionEnabled
                ? '选位通道已手动关闭'
                : !selectionOpenAt
                  ? '请设置自动开放时间'
                  : dayjs().isBefore(selectionOpenAt)
                    ? `将在 ${selectionOpenAt.format('YYYY-MM-DD HH:mm')} 自动开放`
                    : '选位通道已自动开放'}
            description={!selectionEnabled
              ? '手动关闭的优先级最高，即使已经超过自动开放时间，用户也不能选位。'
              : '总开关开启后，系统将在设定时间自动开放选位，无需再次操作。'}
            style={{ marginBottom: 20 }}
          />
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>选位通道总开关</Text>
              <Space>
                <Switch
                  checked={selectionEnabled}
                  checkedChildren="开启"
                  unCheckedChildren="关闭"
                  onChange={(checked) => changeSelectionConfig({ enabled: checked })}
                />
                <Text type="secondary">关闭后会立即阻止网页、APP 和小程序选位</Text>
              </Space>
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>自动开放时间</Text>
              <DatePicker
                showTime={{ format: 'HH:mm' }}
                format="YYYY-MM-DD HH:mm"
                value={selectionOpenAt}
                onChange={(value) => changeSelectionConfig({ openAt: value })}
                style={{ width: '100%' }}
                placeholder="选择自动开放时间"
              />
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                可以早于路演报名截止时间，但必须早于活动开始（{dayjs(selectedSession.event_date).format('YYYY-MM-DD HH:mm')}）。
              </Text>
            </div>
          </Space>
        </Modal>
      )}

      {isLoading || !arrangement ? (
        <div style={{ padding: 64, textAlign: 'center' }}><Spin /></div>
      ) : (
        <>
          <Row gutter={[12, 12]} style={{ marginBottom: 18 }}>
            <Col xs={12} md={6}><Card><Statistic title="已通过组数" value={arrangement.counts.approved_count} prefix={<TeamOutlined />} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="当前已分配 / 待分配" value={`${assignedEntries.length} / ${unassignedEntries.length}`} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="普通位次" value={regularProjectedCapacity} suffix={`含 ${arrangement.counts.reserve_count} 个冗余`} /></Card></Col>
            <Col xs={12} md={6}><Card><Statistic title="中场位次" value={halftimeProjectedCapacity} suffix={`含 ${arrangement.counts.reserve_count} 个冗余`} /></Card></Col>
          </Row>

          <Alert
            showIcon
            type="info"
            message={viewMode === 'board' ? '位次看板使用固定槽位' : '纵向编排使用联动排序'}
            description={viewMode === 'board'
              ? '拖到空位只移动当前组并保留原空位；拖到已有组的位置会交换两组。锁定位次不会被移动或交换。'
              : '拖拽、上下移动和直接设置第 N 组时会自动前移并跳过已锁定组；如需移动锁定组，请先解锁。'}
            style={{ marginBottom: 18 }}
          />

          {viewMode === 'board' ? (
          <Row gutter={[18, 18]} align="top">
            <Col xs={24} xl={18}>
              <Card
                title={<Space><AppstoreOutlined />管理员位次看板</Space>}
                extra={<Text type="secondary">拖动组卡片可调整；空位可接收待分配组</Text>}
                styles={{ body: { padding: 14 } }}
              >
                <AdminPositionBoardSection
                  title="普通路演位"
                  section="regular"
                  entries={regularEntries}
                  capacity={regularProjectedCapacity}
                  eventDate={arrangement.session.event_date}
                  slotMinutes={arrangement.session.slot_minutes}
                  halftimeDelayMinutes={arrangement.session.halftime_delay_minutes}
                  regularTimelineGroupCount={regularTimelineGroupCount}
                  onDrop={handleBoardDrop}
                  onReturnToUnassigned={returnToUnassigned}
                  highlightPositionNo={highlightPositionNo}
                />
                <AdminPositionBoardSection
                  title="中场路演位"
                  section="halftime"
                  entries={halftimeEntries}
                  capacity={halftimeProjectedCapacity}
                  eventDate={arrangement.session.event_date}
                  slotMinutes={arrangement.session.slot_minutes}
                  halftimeDelayMinutes={arrangement.session.halftime_delay_minutes}
                  regularTimelineGroupCount={regularTimelineGroupCount}
                  onDrop={handleBoardDrop}
                  onReturnToUnassigned={returnToUnassigned}
                  highlightPositionNo={highlightPositionNo}
                />
              </Card>
            </Col>
            <Col xs={24} xl={6}>
              <UnassignedPanel
                entries={unassignedEntries}
                regularEntries={regularEntries}
                halftimeEntries={halftimeEntries}
                regularCapacity={regularProjectedCapacity}
                halftimeCapacity={halftimeProjectedCapacity}
                onAssign={assignToPosition}
                onAutoAssign={autoAssignUnassigned}
              />
            </Col>
          </Row>
          ) : (
          <Row gutter={[18, 18]}>
            <Col xs={24} xl={12}>
              <ArrangementSection
                title="普通路演"
                section="regular"
                entries={regularEntries}
                capacity={regularProjectedCapacity}
                eventDate={arrangement.session.event_date}
                slotMinutes={arrangement.session.slot_minutes}
                halftimeDelayMinutes={arrangement.session.halftime_delay_minutes}
                regularTimelineGroupCount={regularTimelineGroupCount}
                onMove={move}
                onMoveToPosition={moveToPosition}
                onMoveToSection={(entry) => relocate(entry.id, 'halftime')}
                onToggleLock={toggleLock}
                onDrop={handleDrop}
                highlightPositionNo={highlightPositionNo}
              />
            </Col>
            <Col xs={24} xl={12}>
              <ArrangementSection
                title="中场路演"
                section="halftime"
                entries={halftimeEntries}
                capacity={halftimeProjectedCapacity}
                eventDate={arrangement.session.event_date}
                slotMinutes={arrangement.session.slot_minutes}
                halftimeDelayMinutes={arrangement.session.halftime_delay_minutes}
                regularTimelineGroupCount={regularTimelineGroupCount}
                onMove={move}
                onMoveToPosition={moveToPosition}
                onMoveToSection={(entry) => relocate(entry.id, 'regular')}
                onToggleLock={toggleLock}
                onDrop={handleDrop}
                highlightPositionNo={highlightPositionNo}
              />
            </Col>
          </Row>
          )}
        </>
      )}
    </div>
  );
}

function AdminPositionBoardSection({
  title,
  section,
  entries,
  capacity,
  eventDate,
  slotMinutes,
  halftimeDelayMinutes,
  regularTimelineGroupCount,
  onDrop,
  onReturnToUnassigned,
  highlightPositionNo,
}: {
  title: string;
  section: RoadshowPositionSection;
  entries: ArrangementEntry[];
  capacity: number;
  eventDate: string;
  slotMinutes: number;
  halftimeDelayMinutes: number;
  regularTimelineGroupCount: number;
  onDrop: (sourceId: number, targetSection: RoadshowPositionSection, targetPosition: number) => void;
  onReturnToUnassigned: (entryId: number) => void;
  highlightPositionNo?: number | null;
}) {
  const entryByPosition = new Map(entries.map((entry) => [entry.position_no, entry]));
  return (
    <div style={{ marginBottom: section === 'regular' ? 22 : 0 }}>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text strong>{title}</Text>
        <Text type="secondary">{entries.length} 组 · {Math.max(0, capacity - entries.length)} 空位</Text>
      </Space>
      <Row gutter={[10, 10]}>
        {Array.from({ length: capacity }, (_, index) => index + 1).map((positionNo) => {
          const entry = entryByPosition.get(positionNo);
          const highlighted = !!entry && entry.position_no === highlightPositionNo;
          const minuteOffset = calculateRoadshowPositionMinuteOffset(
            section,
            positionNo,
            regularTimelineGroupCount,
            slotMinutes,
            halftimeDelayMinutes,
          );
          const referenceTime = dayjs(eventDate).add(minuteOffset, 'minute').format('MM-DD HH:mm');
          return (
            <Col key={`${section}-${positionNo}`} xs={12} sm={8} md={6} xxl={4}>
              <div
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  const sourceId = Number(event.dataTransfer.getData('text/roadshow-registration'));
                  if (Number.isInteger(sourceId)) onDrop(sourceId, section, positionNo);
                }}
                style={{
                  minHeight: 132,
                  height: '100%',
                  border: highlighted
                    ? '2px solid #ff4d4f'
                    : entry
                      ? entry.locked ? '1px solid #f5c26b' : '1px solid #91caff'
                      : '1px dashed #b8c4d6',
                  borderRadius: 10,
                  padding: 10,
                  background: highlighted
                    ? '#fff1f0'
                    : entry
                      ? entry.locked ? '#fffaf0' : '#f0f7ff'
                      : '#fafcff',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Space size={4} style={{ justifyContent: 'space-between' }}>
                  <Text strong style={{ color: section === 'regular' ? '#1677ff' : '#d46b08' }}>
                    {section === 'regular' ? `普通 ${positionNo}` : `中场 ${positionNo}`}
                  </Text>
                  {entry?.locked && <LockOutlined style={{ color: '#d48806' }} />}
                </Space>
                <Text type="secondary" style={{ fontSize: 11 }}>{referenceTime}{section === 'halftime' ? ' 参考' : ''}</Text>
                {entry ? (
                  <div
                    draggable={!entry.locked}
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/roadshow-registration', String(entry.id));
                    }}
                    style={{ marginTop: 7, cursor: entry.locked ? 'not-allowed' : 'grab', minWidth: 0 }}
                  >
                    <Text strong ellipsis title={entry.group_name} style={{ display: 'block' }}>{entry.group_name}</Text>
                    <Text type="secondary" ellipsis title={`${entry.artist_name} - ${entry.song_name}`} style={{ display: 'block', fontSize: 12 }}>
                      {entry.artist_name} - {entry.song_name}
                    </Text>
                    <Space size={4} wrap style={{ marginTop: 5 }}>
                      <Tag color={entry.original_position === null ? 'gold' : 'green'} style={{ marginInlineEnd: 0 }}>
                        {entry.original_position === null ? '管理员待保存' : '已占用'}
                      </Tag>
                      {!entry.locked && (
                        <Button type="link" size="small" style={{ padding: 0, height: 'auto' }} onClick={() => onReturnToUnassigned(entry.id)}>
                          撤回
                        </Button>
                      )}
                    </Space>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>空位<br />拖入待分配组</Text>
                  </div>
                )}
              </div>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}

function UnassignedPanel({
  entries,
  regularEntries,
  halftimeEntries,
  regularCapacity,
  halftimeCapacity,
  onAssign,
  onAutoAssign,
}: {
  entries: ArrangementEntry[];
  regularEntries: ArrangementEntry[];
  halftimeEntries: ArrangementEntry[];
  regularCapacity: number;
  halftimeCapacity: number;
  onAssign: (entryId: number, section: RoadshowPositionSection, positionNo: number) => void;
  onAutoAssign: () => void;
}) {
  const occupiedRegular = new Set(regularEntries.map((entry) => entry.position_no));
  const occupiedHalftime = new Set(halftimeEntries.map((entry) => entry.position_no));
  const options = [
    ...Array.from({ length: regularCapacity }, (_, index) => index + 1)
      .filter((positionNo) => !occupiedRegular.has(positionNo))
      .map((positionNo) => ({ value: `regular:${positionNo}`, label: `普通 ${positionNo}` })),
    ...Array.from({ length: halftimeCapacity }, (_, index) => index + 1)
      .filter((positionNo) => !occupiedHalftime.has(positionNo))
      .map((positionNo) => ({ value: `halftime:${positionNo}`, label: `中场 ${positionNo}` })),
  ];
  return (
    <Card
      title="用户未选位"
      extra={<Tag color={entries.length > 0 ? 'gold' : 'success'}>{entries.length} 组</Tag>}
      styles={{ body: { padding: 12 } }}
    >
      {entries.length > 0 && (
        <Button block style={{ marginBottom: 12 }} onClick={onAutoAssign}>全部顺序排入普通空位</Button>
      )}
      {entries.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="所有组均已分配" />
      ) : entries.map((entry) => (
        <div
          key={entry.id}
          draggable
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/roadshow-registration', String(entry.id));
          }}
          style={{
            border: '1px solid #ffe58f',
            background: '#fffbe6',
            borderRadius: 10,
            padding: 10,
            marginBottom: 10,
            cursor: 'grab',
          }}
        >
          <Text strong ellipsis title={entry.group_name} style={{ display: 'block' }}>{entry.group_name}</Text>
          <Text type="secondary" ellipsis title={`${entry.artist_name} - ${entry.song_name}`} style={{ display: 'block', fontSize: 12, marginBottom: 8 }}>
            {entry.artist_name} - {entry.song_name}
          </Text>
          <Select
            size="small"
            value={undefined}
            options={options}
            placeholder="分配到空位"
            style={{ width: '100%' }}
            onChange={(value: string) => {
              const [section, positionNo] = value.split(':');
              onAssign(entry.id, section as RoadshowPositionSection, Number(positionNo));
            }}
          />
        </div>
      ))}
      {entries.length > 0 && (
        <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
          可拖到左侧空位，或用下拉菜单精确分配；未分配组可以继续保留在这里。
        </Text>
      )}
    </Card>
  );
}

function ArrangementSection({
  title,
  section,
  entries,
  capacity,
  eventDate,
  slotMinutes,
  halftimeDelayMinutes,
  regularTimelineGroupCount,
  onMove,
  onMoveToPosition,
  onMoveToSection,
  onToggleLock,
  onDrop,
  highlightPositionNo,
}: {
  title: string;
  section: RoadshowPositionSection;
  entries: ArrangementEntry[];
  capacity: number;
  eventDate: string;
  slotMinutes: number;
  halftimeDelayMinutes: number;
  regularTimelineGroupCount: number;
  onMove: (section: RoadshowPositionSection, entryId: number, direction: -1 | 1) => void;
  onMoveToPosition: (entryId: number, section: RoadshowPositionSection, positionNo: number) => void;
  onMoveToSection: (entry: ArrangementEntry) => void;
  onToggleLock: (entryId: number) => void;
  onDrop: (sourceId: number, targetSection: RoadshowPositionSection, targetPosition: number) => void;
  highlightPositionNo?: number | null;
}) {
  const available = Math.max(0, capacity - entries.length);
  const lockedCount = entries.filter((entry) => entry.locked).length;
  return (
    <Card
      title={title}
      extra={<Space><Tag color={section === 'regular' ? 'blue' : 'orange'}>{entries.length} 组</Tag>{lockedCount > 0 && <Tag icon={<LockOutlined />}>{lockedCount} 组锁定</Tag>}<Text type="secondary">空 {available} 位</Text></Space>}
      styles={{ body: { padding: 12 } }}
    >
      {entries.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未安排路演组" />
      ) : entries.map((entry) => (
        <ArrangementRow
          key={`${entry.id}-${entry.position_no}`}
          entry={entry}
          section={section}
          capacity={capacity}
          eventDate={eventDate}
          slotMinutes={slotMinutes}
          halftimeDelayMinutes={halftimeDelayMinutes}
          regularTimelineGroupCount={regularTimelineGroupCount}
          onMove={onMove}
          onMoveToPosition={onMoveToPosition}
          onMoveToSection={onMoveToSection}
          onToggleLock={onToggleLock}
          onDrop={onDrop}
          highlightPositionNo={highlightPositionNo}
        />
      ))}
      {available > 0 && (
        <div style={{ border: '1px dashed #d9e2ef', borderRadius: 12, padding: 12, textAlign: 'center', color: '#8c98a8' }}>
          剩余 {available} 个动态空位
        </div>
      )}
    </Card>
  );
}

function ArrangementRow({
  entry,
  section,
  capacity,
  eventDate,
  slotMinutes,
  halftimeDelayMinutes,
  regularTimelineGroupCount,
  onMove,
  onMoveToPosition,
  onMoveToSection,
  onToggleLock,
  onDrop,
  highlightPositionNo,
}: {
  entry: ArrangementEntry;
  section: RoadshowPositionSection;
  capacity: number;
  eventDate: string;
  slotMinutes: number;
  halftimeDelayMinutes: number;
  regularTimelineGroupCount: number;
  onMove: (section: RoadshowPositionSection, entryId: number, direction: -1 | 1) => void;
  onMoveToPosition: (entryId: number, section: RoadshowPositionSection, positionNo: number) => void;
  onMoveToSection: (entry: ArrangementEntry) => void;
  onToggleLock: (entryId: number) => void;
  onDrop: (sourceId: number, targetSection: RoadshowPositionSection, targetPosition: number) => void;
  highlightPositionNo?: number | null;
}) {
  const [targetPosition, setTargetPosition] = useState<number | null>(entry.position_no);
  const [jumpOpen, setJumpOpen] = useState(false);
  const minuteOffset = calculateRoadshowPositionMinuteOffset(
    section,
    entry.position_no,
    regularTimelineGroupCount,
    slotMinutes,
    halftimeDelayMinutes,
  );
  const referenceTime = dayjs(eventDate).add(minuteOffset, 'minute').format('MM-DD HH:mm');

  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const sourceId = Number(event.dataTransfer.getData('text/roadshow-registration'));
        if (Number.isInteger(sourceId)) onDrop(sourceId, section, entry.position_no);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 8px',
        marginBottom: 8,
        border: entry.position_no === highlightPositionNo
          ? '2px solid #ff4d4f'
          : entry.locked ? '1px solid #f5c26b' : '1px solid #edf0f5',
        borderRadius: 12,
        background: entry.position_no === highlightPositionNo
          ? '#fff1f0'
          : entry.locked ? '#fffaf0' : '#fafcff',
      }}
    >
      <Tooltip title={entry.locked ? '请先解锁再拖拽' : '按住拖拽调整顺序'}>
        <span
          draggable={!entry.locked}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/roadshow-registration', String(entry.id));
          }}
          style={{ cursor: entry.locked ? 'not-allowed' : 'grab', color: entry.locked ? '#d48806' : '#8c98a8', fontSize: 18 }}
        >
          {entry.locked ? <LockOutlined /> : <HolderOutlined />}
        </span>
      </Tooltip>
      <div style={{ width: 62, flexShrink: 0, textAlign: 'center' }}>
        <Text strong style={{ display: 'block', color: entry.locked ? '#d48806' : '#1677ff' }}>#{entry.position_no}</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>{referenceTime}</Text>
      </div>
      <div style={{ flex: 1, minWidth: 180 }}>
        <Space size={6} wrap>
          <Text strong>{entry.group_name}</Text>
          <Tag color="geekblue">{entry.owner_username || '未知用户'} · UID {entry.owner_uid}</Tag>
          {entry.original_position === null && <Tag color="gold">原未选位</Tag>}
        </Space>
        <Text type="secondary" ellipsis style={{ display: 'block', fontSize: 12 }}>
          {entry.artist_name} - {entry.song_name}
        </Text>
        <Text style={{ display: 'block', fontSize: 12, marginTop: 3, color: entry.additional_requirements ? '#ad6800' : '#9aa4b2' }}>
          备注：{entry.additional_requirements || '无'}
        </Text>
      </div>
      <Space size={4} wrap style={{ justifyContent: 'flex-end' }}>
        <Popover
          trigger="click"
          placement="bottomRight"
          open={jumpOpen}
          onOpenChange={(open) => {
            if (!entry.locked) {
              setTargetPosition(entry.position_no);
              setJumpOpen(open);
            }
          }}
          title="直接设置组数"
          content={(
            <Space>
              <InputNumber
                autoFocus
                min={1}
                max={capacity}
                value={targetPosition}
                onChange={(value) => setTargetPosition(value)}
                addonBefore="第"
                addonAfter="组"
                style={{ width: 140 }}
                onPressEnter={() => {
                  if (targetPosition && targetPosition !== entry.position_no) {
                    onMoveToPosition(entry.id, section, targetPosition);
                    setJumpOpen(false);
                  }
                }}
              />
              <Button
                type="primary"
                disabled={!targetPosition || targetPosition === entry.position_no}
                onClick={() => {
                  onMoveToPosition(entry.id, section, targetPosition!);
                  setJumpOpen(false);
                }}
              >
                确定
              </Button>
            </Space>
          )}
        >
          <Button size="small" disabled={entry.locked}>
            指定组数
          </Button>
        </Popover>
        <Tooltip title={entry.locked ? '解锁后可移动' : '锁定后其他调整会跳过此序号'}>
          <Button
            size="small"
            type={entry.locked ? 'primary' : 'default'}
            danger={entry.locked}
            icon={entry.locked ? <UnlockOutlined /> : <LockOutlined />}
            onClick={() => onToggleLock(entry.id)}
          >
            {entry.locked ? '解锁' : '锁定'}
          </Button>
        </Tooltip>
        <Button size="small" icon={<SwapOutlined />} disabled={entry.locked} onClick={() => onMoveToSection(entry)}>
          {section === 'regular' ? '移至中场' : '移至普通'}
        </Button>
        <Button size="small" icon={<ArrowUpOutlined />} disabled={entry.locked} onClick={() => onMove(section, entry.id, -1)} />
        <Button size="small" icon={<ArrowDownOutlined />} disabled={entry.locked} onClick={() => onMove(section, entry.id, 1)} />
      </Space>
    </div>
  );
}
