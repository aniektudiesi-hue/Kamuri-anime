export type Anime = {
  anime_id?: string;
  mal_id?: string | number;
  id?: string | number;
  title?: string;
  title_jp?: string;
  title_en?: string;
  name?: string;
  english?: string;
  japanese?: string;
  titles?: { type?: string; title?: string }[] | Record<string, string | undefined>;
  poster?: string;
  image?: string;
  thumbnail?: string;
  image_url?: string;
  img_url?: string;
  banner?: string;
  cover?: string;
  images?: {
    jpg?: Record<string, string | undefined>;
    webp?: Record<string, string | undefined>;
  };
  num_episodes?: number;
  episode_count?: number;
  episodes?: number;
  score?: number;
  status?: string;
};

export type Episode = {
  episode_number: number;
  title?: string;
};

export type EpisodeResponse = {
  anime_id: string;
  num_episodes: number;
  episodes: Episode[];
  source?: string;
};

export type Subtitle = {
  file: string;
  label?: string;
  kind?: string;
  default?: boolean;
};

export type StreamResponse = {
  m3u8_url?: string;
  url?: string;
  stream_url?: string;
  iframe_url?: string;
  embed_url?: string;
  subtitles?: Subtitle[];
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  server_id?: number;
  mal_id?: string;
  episode_num?: string;
};

export type User = {
  id?: string | number;
  username?: string;
  email?: string;
  name?: string;
};

export type LibraryItem = Anime & {
  mal_id?: string;
  episode?: number;
  episode_num?: number;
  progress?: number;
  timestamp?: number;
  duration?: number;
  watched_at?: string;
  created_at?: string;
};
