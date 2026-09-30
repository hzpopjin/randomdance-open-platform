import request from '../utils/request';
import type { ApiResponse, PaginatedData } from '../types/api';
import type { Submission, SubmissionDetail, SubmissionStatistics } from '../types/submission';

export function getSubmissions(params?: {
  page?: number; page_size?: number; session_id?: number; status?: string; keyword?: string;
}) {
  return request.get<ApiResponse<PaginatedData<Submission>>>('/admin/submissions', { params });
}

export function getSubmissionDetail(id: number) {
  return request.get<ApiResponse<SubmissionDetail>>(`/admin/submissions/${id}`);
}

export function reviewSubmission(id: number, data: { status: string; review_comment?: string }) {
  return request.put<ApiResponse<null>>(`/admin/submissions/${id}/status`, data);
}

export function batchReviewSubmissions(data: { ids: number[]; status: string; review_comment?: string }) {
  return request.post<ApiResponse<null>>('/admin/submissions/batch', data);
}

export function deleteSubmission(id: number) {
  return request.delete<ApiResponse<{ id: number }>>(`/admin/submissions/${id}`);
}

export function batchDeleteSubmissions(ids: number[]) {
  return request.delete<ApiResponse<{ affected: number }>>('/admin/submissions/batch', { data: { ids } });
}

export function exportSubmissions(params?: Record<string, any>) {
  return request.get('/admin/submissions/export', { params, responseType: 'blob' });
}

export function getSubmissionStatistics(params?: { session_id?: number }) {
  return request.get<ApiResponse<SubmissionStatistics>>('/admin/submissions/statistics', { params });
}
