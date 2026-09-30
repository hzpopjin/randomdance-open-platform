import request from '../utils/request';
import type { ApiResponse, PaginatedData } from '../types/api';

export interface SystemLog {
  id: number; level: string; type: string; method: string | null;
  path: string | null; status_code: number | null; business_code: number | null;
  message: string | null; duration_ms: number | null; ip: string | null;
  user_agent: string | null; user_id: string | null; request_id: string | null;
  query_payload: any; request_payload: any; response_payload: any; error_stack: string | null;
  created_at: string;
}

export function getSystemLogs(params?: { page?: number; page_size?: number; level?: string; type?: string; keyword?: string }) {
  return request.get<ApiResponse<PaginatedData<SystemLog>>>('/admin/system-logs', { params });
}

export function getSystemLogDetail(id: number) {
  return request.get<ApiResponse<SystemLog>>(`/admin/system-logs/${id}`);
}

export function deleteSystemLog(id: number) {
  return request.delete<ApiResponse<{ id: number }>>(`/admin/system-logs/${id}`);
}

export function batchDeleteSystemLogs(ids: number[]) {
  return request.delete<ApiResponse<{ affected: number }>>('/admin/system-logs/batch', { data: { ids } });
}

export function clearAllSystemLogs() {
  return request.delete<ApiResponse<{ cleared: boolean }>>('/admin/system-logs/clear');
}
