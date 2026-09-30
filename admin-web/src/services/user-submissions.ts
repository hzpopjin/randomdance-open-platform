import request from '../utils/request';
import type { ApiResponse, PaginatedData } from '../types/api';
import type { Submission, SubmissionDetail } from '../types/submission';

export function submitSubmission(data: {
  session_id: number;
  songs: Array<{
    song_id?: number | null; song_name: string; artist_name: string;
    alt_title?: string; full_title?: string; file_extension?: string;
    full_file_path?: string; chorus_file_path?: string; reference_url?: string;
    play_part: number; custom_part_desc?: string; sort_order?: number;
  }>;
}) {
  return request.post<ApiResponse<{ id: number }>>('/submissions', data);
}

export function getMySubmissions(params?: { page?: number; page_size?: number }) {
  return request.get<ApiResponse<PaginatedData<Submission>>>('/submissions/mine', { params });
}

export function getSubmissionDetail(id: number) {
  return request.get<ApiResponse<SubmissionDetail>>(`/submissions/${id}`);
}
