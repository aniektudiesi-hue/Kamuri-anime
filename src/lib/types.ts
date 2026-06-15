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
  cr_poster?: string;
  cr_hero?: string;
  detail_banner?: string;
  title_logo?: string;
  synopsis?: string;
  cover?: string;
  overview?: string;
  genres?: string[];
  studios?: string[];
  source?: string;
  images?: {
    jpg?: Record<string, string | undefined>;
    webp?: Record<string, string | undefined>;
  };
  num_episodes?: number;
  episode_count?: number;
  episodes?: number;
  score?: number;
  status?: string;
  start_date?: string;
  year?: number;
  format?: string;        // TV | MOVIE | OVA | SPECIAL | ONA
  season_count?: number;  // number of seasons in the franchise (root only)
  cr_mapped?: boolean;    // true when this title has Crunchyroll keyart/poster mapped
};

export type Episode = {
  episode_number: number; // number used to fetch the stream (owner MAL's real episode)
  display_number?: number; // number shown to the user (restarts at 1 each season)
  title?: string;
  thumbnail?: string;
  duration_ms?: number;
  has_stream?: boolean;
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
  headers?: Record<string, string>;
  server?: string;
  subtitles?: Subtitle[];
  subtitle_url?: string;
  vtt_url?: string;
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
  offline_id?: string;
  size?: number;
  playback_pos?: number;
  progress?: number;
  timestamp?: number;
  duration?: number;
  added_at?: string;
  watched_at?: string | number;
  created_at?: string;
};

export type AiringScheduleItem = {
  id: string;
  episode: number;
  airingAt: number;
  anime: Anime;
};

export type HomeInitialData = {
  banners: Anime[];
  thumbnails: Anime[];      // April / Spring 2026 season
  recent: Anime[];          // New Episodes
  topRated: Anime[];        // Top Picks
  popular: Anime[];         // Most Popular
  famousNew: Anime[];       // Familiar high-demand recent/famous titles
  romance: Anime[];         // Rom-com / harem
  isekai: Anime[];          // Isekai
  sports: Anime[];          // Sports
  selfImprovement: Anime[]; // Growth / self-improvement picks
  healing: Anime[];         // Healing / slice-of-life
  schedule: AiringScheduleItem[];
  generatedAt: string;
};
