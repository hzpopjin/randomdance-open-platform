import type { SubmissionStatus } from './api';

export interface Submission {
  id: number;
  user_id: number;
  user_nickname: string;
  username: string;
  user_phone: string | null;
  session_id: number;
  session_name: string;
  status: SubmissionStatus;
  song_count: number;
  custom_song_count?: number;
  created_at: string;
  updated_at: string;
}

export interface SubmissionDetail extends Submission {
  songs: SubmissionSong[];
}

export interface SubmissionSong {
  id: number;
  song_id: number | null;
  song_name: string;
  artist_name: string;
  alt_title: string | null;
  full_title: string | null;
  file_extension: string | null;
  reference_url: string | null;
  play_part: 0 | 1 | 2;
  custom_part_desc: string | null;
  sort_order: number;
}

export interface SubmissionStatisticsSong {
  song: string;
  artist_name: string;
  song_name: string;
  count: number;
}

export interface SubmissionStatistics {
  hot_songs: SubmissionStatisticsSong[];
  custom_songs: SubmissionStatisticsSong[];
  session_stats: Array<{ session_name: string; count: number }>;
  total_submissions: number;
}
