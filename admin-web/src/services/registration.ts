import request from '../utils/request';
import type { ApiResponse, PaginatedData } from '../types/api';
import type { Registration, RegistrationDetail } from '../types/roadshow';

export function submitRegistration(data: {
  session_id: number;
  song_name: string;
  artist_name: string;
  group_name: string;
  song_format: number;
  edited_file_url?: string;
  members: { member_name: string; position: string; sort_order: number }[];
  contact_phone: string;
  has_other_performance: number;
  other_performance_detail?: string;
  additional_requirements?: string;
}) {
  return request.post<ApiResponse<{ id: number }>>('/roadshow/registrations', data);
}

export function getMyRegistrations(params?: { page?: number; page_size?: number }) {
  return request.get<ApiResponse<PaginatedData<Registration>>>('/roadshow/registrations/mine', { params });
}

export function getRegistrationDetail(id: number) {
  return request.get<ApiResponse<RegistrationDetail>>(`/roadshow/registrations/${id}`);
}

export function getAvailableSessions(organizerId?: number) {
  return request.get<ApiResponse<{
    list: { id: number; name: string; event_date: string; location: string; registration_end: string; venue_info?: string; organizer_id?: number | null; organizer_name?: string | null }[];
    total: number;
  }>>('/sessions', { params: organizerId !== undefined ? { organizer_id: organizerId } : undefined });
}

// 公共主办方列表（无需鉴权）：{ list: [{ id, name }], total }
export function getOrganizers() {
  return request.get<ApiResponse<{
    list: { id: number; name: string }[];
    total: number;
  }>>('/organizers');
}
