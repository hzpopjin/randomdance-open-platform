import request from '../utils/request';
import type { ApiResponse, PaginatedData } from '../types/api';

export interface ClientEvent {
  id: number; event_id: string; event_type: string; platform: string | null;
  device_id: string | null; request_id: string | null; uid: string | null;
  ip: string | null; user_agent: string | null; resource_type: string | null;
  resource_id: string | null; context_payload: any; app_version: string | null;
  device_model: string | null; os_version: string | null;
  occurred_at: string; received_at: string;
}

export function getClientEvents(params?: { page?: number; page_size?: number; event_type?: string; keyword?: string }) {
  return request.get<ApiResponse<PaginatedData<ClientEvent>>>('/admin/client-events', { params });
}

export function deleteClientEvent(id: number) {
  return request.delete<ApiResponse<{ id: number }>>(`/admin/client-events/${id}`);
}

export function batchDeleteClientEvents(ids: number[]) {
  return request.delete<ApiResponse<{ affected: number }>>('/admin/client-events/batch', { data: { ids } });
}
