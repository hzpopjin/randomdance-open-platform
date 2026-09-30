import request from '../utils/request';
import type { ApiResponse, PaginatedData } from '../types/api';
import type { Session, SessionFormData } from '../types/session';

export function getSessions(params?: { page?: number; page_size?: number }) {
  return request.get<ApiResponse<PaginatedData<Session>>>('/admin/sessions', { params });
}

export function createSession(data: SessionFormData) {
  return request.post<ApiResponse<Session>>('/admin/sessions', data);
}

export function updateSession(id: number, data: Partial<SessionFormData>) {
  return request.put<ApiResponse<Session>>(`/admin/sessions/${id}`, data);
}

export function deleteSession(id: number) {
  return request.delete<ApiResponse<Pick<Session, 'id' | 'name'>>>(`/admin/sessions/${id}`);
}

export function cancelSession(id: number) {
  return request.put<ApiResponse<Session>>(`/admin/sessions/${id}/cancel`);
}

export function restoreSession(id: number) {
  return request.put<ApiResponse<Session>>(`/admin/sessions/${id}/restore`);
}
