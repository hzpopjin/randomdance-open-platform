import axios from 'axios';
import type { FastAPISongsResponse, FastAPISong, FastAPIPlaylist, FastAPIPlaylistDetail, FastAPIArtistsResponse } from '../types/fastapi';

const FASTAPI_BASE = import.meta.env.VITE_FASTAPI_BASE_URL || '/fa-api';

const fastapi = axios.create({ baseURL: FASTAPI_BASE, timeout: 15000 });

export async function getSongs(params: { page?: number; page_size?: number; search?: string; artist?: string }): Promise<FastAPISongsResponse> {
  const res = await fastapi.get<FastAPISongsResponse>('/songs', { params });
  return res.data;
}

export async function getSongDetail(id: number): Promise<FastAPISong> {
  const res = await fastapi.get<FastAPISong>(`/songs/${id}`);
  return res.data;
}

export async function getArtists(): Promise<string[]> {
  const res = await fastapi.get<FastAPIArtistsResponse>('/songs/artists');
  return res.data.artists;
}

export async function getPlaylists(): Promise<FastAPIPlaylist[]> {
  const res = await fastapi.get('/playlists');
  const data = res.data;
  return Array.isArray(data) ? data : data.playlists ?? [];
}

export async function getPlaylistDetail(id: string): Promise<FastAPIPlaylistDetail> {
  const res = await fastapi.get<FastAPIPlaylistDetail>(`/playlists/${id}`);
  return res.data;
}

export function getChorusStreamUrl(id: number): string {
  return `${FASTAPI_BASE}/songs/stream/chorus/${id}`;
}

export function getFullStreamUrl(id: number): string {
  return `${FASTAPI_BASE}/songs/stream/${id}`;
}
