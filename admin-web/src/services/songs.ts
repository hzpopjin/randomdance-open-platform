import request from '../utils/request';
import type { ApiResponse, PaginatedData } from '../types/api';
import type { Song, SongFormData } from '../types/song';

export function getSongs(params?: { page?: number; page_size?: number; keyword?: string; status?: string }) {
  return request.get<ApiResponse<PaginatedData<Song>>>('/admin/songs', { params });
}

export function createSong(data: SongFormData) {
  return request.post<ApiResponse<Song>>('/admin/songs', data);
}

export function updateSong(id: number, data: Partial<SongFormData>) {
  return request.put<ApiResponse<Song>>(`/admin/songs/${id}`, data);
}

export function deleteSong(id: number) {
  return request.delete<ApiResponse<null>>(`/admin/songs/${id}`);
}

export function updateSongStatus(id: number, status: number) {
  return request.put<ApiResponse<null>>(`/admin/songs/${id}/status`, { status });
}

export function getPendingSongs(params?: { page?: number; page_size?: number }) {
  return request.get<ApiResponse<PaginatedData<Song>>>('/admin/songs/pending', { params });
}
