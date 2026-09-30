export interface Session {
  id: number;
  name: string;
  event_date: string;
  location: string;
  registration_start: string;
  registration_end: string;
  venue_info?: string;
  roadshow_selection_enabled?: boolean;
  roadshow_selection_open_at?: string | null;
  roadshow_slot_minutes?: number;
  roadshow_halftime_delay_minutes?: number;
  is_cancelled?: boolean;
  cancelled_at?: string | null;
  registration_count?: number;
  submission_count?: number;
  // 归属主办方的 users.id；NULL 仅允许出现在回填前
  organizer_id?: number | null;
  // 主办方对外展示名（JOIN users 得到）
  organizer_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionFormData {
  name: string;
  event_date: string;
  location: string;
  registration_start?: string;
  registration_end?: string;
  venue_info?: string;
  roadshow_selection_enabled?: boolean;
  roadshow_selection_open_at?: string | null;
  roadshow_slot_minutes?: number;
  roadshow_halftime_delay_minutes?: number;
  // 超管可显式指定归属主办方；主办方登录时不提交（由后端强制为自身）
  organizer_id?: number;
}
