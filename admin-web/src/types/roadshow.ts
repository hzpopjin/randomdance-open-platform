import type { RegistrationStatus } from './api';

export interface Registration {
  id: number;
  user_id: number;
  user_nickname: string;
  username: string;
  session_id: number;
  session_name: string;
  song_name: string;
  artist_name: string;
  group_name: string;
  song_format: number;
  edited_file_url?: string;
  // 管理端列表/详情追加的对象存储签名访问地址（私有读，短期有效）。
  audio_access_url?: string | null;
  review_video_url?: string | null;
  review_video_access_url?: string | null;
  contact_phone: string;
  has_other_performance: number;
  other_performance_detail?: string;
  additional_requirements?: string;
  status: RegistrationStatus;
  review_comment?: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface RegistrationDetail extends Registration {
  members: RegistrationMember[];
}

export interface RegistrationMember {
  id: number;
  member_name: string;
  position: string;
  sort_order: number;
}

// ==================== 路演选位（用户选位面板） ====================

export type RoadshowPositionSection = 'regular' | 'halftime';
export type RoadshowPositionStatus = 'available' | 'occupied' | 'mine';
export type RoadshowSelectionState = 'disabled' | 'not_configured' | 'not_open' | 'open' | 'cancelled';

export interface RoadshowPositionItem {
  id: number;
  section: RoadshowPositionSection;
  position_no: number;
  label: string;
  reference_time: string | null;
  reference_time_only: boolean;
  status: RoadshowPositionStatus;
  occupant: {
    group_name: string;
    song_name: string;
    artist_name: string;
  } | null;
  registration_id: number | null;
  selected_at: string | null;
}

export interface RoadshowPositionBoard {
  registration: {
    id: number;
    group_name: string;
    song_name: string;
    artist_name: string;
    status: RegistrationStatus;
    eligible: boolean;
  };
  session: {
    id: number;
    name: string;
    event_date: string;
    location: string;
    selection_enabled: boolean;
    selection_open_at: string | null;
    slot_minutes: number;
    halftime_delay_minutes: number;
  };
  selection_state: RoadshowSelectionState;
  selection_state_message: string;
  server_time: string;
  capacity: {
    approved_registration_count: number;
    reserve_count: number;
    calculated_regular_count: number;
    calculated_halftime_count: number;
    regular_count: number;
    halftime_count: number;
    total_count: number;
  };
  current_selection: RoadshowPositionItem | null;
  positions: RoadshowPositionItem[];
}

// ==================== 管理端编排 ====================

export interface SortItem {
  id: number;
  sort_order: number;
  halftime_after: boolean;
}

export interface RoadshowArrangementRegistration {
  id: number;
  group_name: string;
  song_name: string;
  artist_name: string;
  additional_requirements: string | null;
  owner_username: string;
  owner_uid: number;
  owner_user_id: number;
  member_count: number;
  sort_order: number | null;
  created_at: string;
  // 后端编排视图已返回报名状态（'pending' | 'approved' | 'rejected'），前端据此过滤非已通过报名。
  status: RegistrationStatus;
}

export interface RoadshowArrangementPosition {
  id: number;
  section: RoadshowPositionSection;
  position_no: number;
  reference_time: string | null;
  selected_at: string | null;
  locked: boolean;
  registration: RoadshowArrangementRegistration | null;
}

export interface RoadshowArrangement {
  session: {
    id: number;
    name: string;
    event_date: string;
    location: string;
    selection_enabled: boolean;
    selection_open_at: string | null;
    slot_minutes: number;
    halftime_delay_minutes: number;
    is_cancelled: boolean;
  };
  version: string;
  counts: {
    total_registration_count: number;
    approved_count: number;
    pending_count: number;
    rejected_count: number;
    selected_count: number;
    unselected_count: number;
    reserve_count: number;
    regular_position_count: number;
    halftime_position_count: number;
  };
  positions: RoadshowArrangementPosition[];
  unassigned_registrations: RoadshowArrangementRegistration[];
}

// ==================== 路演素材直传（TOS） ====================

export type RoadshowMediaType = 'audio' | 'review-video';
export type RoadshowMediaStatus = 'not_submitted' | 'approved_without_upload' | 'submitted';

export interface RoadshowMediaSlotState {
  uploaded: boolean;
  enabled: boolean;
  status: RoadshowMediaStatus;
  url: string | null;
  access_url: string | null;
  availability: 'available' | 'missing' | 'unmanaged' | null;
  max_size: number;
}

export interface RoadshowMediaState {
  registration_id: number;
  audio: RoadshowMediaSlotState;
  review_video: RoadshowMediaSlotState;
  // 对象存储是否启用；为 false 时前端隐藏审核视频上传入口。undefined（旧后端）时按允许处理。
  video_upload_enabled?: boolean;
}

/** TOS 已启用：预签名直传票据。 */
export interface RoadshowMediaDirectTicket {
  mode: 'direct';
  method: 'PUT';
  upload_url: string;
  object_key: string;
  headers: Record<string, string>;
  expires_in: number;
  max_size: number;
}

/** TOS 未启用：回退到服务端 multipart 本地上传（无 upload_url/object_key）。 */
export interface RoadshowMediaLocalTicket {
  mode: 'local';
  max_size: number;
}

export type RoadshowMediaUploadTicket =
  | RoadshowMediaDirectTicket
  | RoadshowMediaLocalTicket;
