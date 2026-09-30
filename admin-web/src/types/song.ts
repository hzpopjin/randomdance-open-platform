export interface Song {
  id: number;
  song_name: string;
  artist_name: string;
  alt_title: string | null;
  remark: string | null;
  status: number;
  user_id?: number;
  created_at: string;
  updated_at: string;
}

export interface SongFormData {
  song_name: string;
  artist_name: string;
  alt_title?: string;
  remark?: string;
}
