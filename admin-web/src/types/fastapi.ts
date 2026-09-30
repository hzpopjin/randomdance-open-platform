export interface FastAPISong {
  id: number;
  artist: string;
  title: string;
  alt_title: string | null;
  full_title: string | null;
  remark: string | null;
  filename: string;
  file_extension: string;
  full_file_path: string;
  chorus_filename: string | null;
  chorus_file_path: string | null;
  created_at: string;
}

export interface FastAPIPlaylist {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  song_ids: number[];
  is_default: boolean;
  created_at: string;
}

export interface FastAPIPlaylistDetail {
  id: string;
  name: string;
  description: string | null;
  cover_url: string | null;
  songs: FastAPISong[];
  created_at: string;
}

export interface FastAPISongsResponse {
  songs: FastAPISong[];
  total: number;
  page: number;
  page_size: number;
}

export interface FastAPIArtistsResponse {
  artists: string[];
}
