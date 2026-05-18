import type { Anime } from "@/lib/types";
import { animePath, watchPath } from "@/lib/utils";

export type FamousAnime = Anime & {
  mal_id: string;
  title: string;
  keywords: string[];
  primaryEpisode?: number;
};

export type SeoKeywordPage = {
  slug: string;
  title: string;
  h1: string;
  description: string;
  intro: string;
  intent: "anime" | "genre" | "top-list" | "episodes";
  keywords: string[];
  animeTitles: string[];
  genreLinks?: string[];
  categoryLinks?: { label: string; href: string }[];
};

export const FAMOUS_ANIME: FamousAnime[] = [
  { mal_id: "21", title: "One Piece", episodes: 1161, score: 8.73, keywords: ["one piece episode watch", "watch one piece episodes", "one piece anime online"], primaryEpisode: 1 },
  { mal_id: "20", title: "Naruto", episodes: 220, score: 7.99, keywords: ["watch naruto episodes", "naruto anime watch online"] },
  { mal_id: "1735", title: "Naruto: Shippuden", episodes: 500, score: 8.28, keywords: ["watch naruto shippuden", "naruto shippuden episodes"] },
  { mal_id: "269", title: "Bleach", episodes: 366, score: 7.96, keywords: ["watch bleach episodes", "bleach anime online"] },
  { mal_id: "16498", title: "Attack on Titan", episodes: 25, score: 8.54, keywords: ["watch attack on titan", "attack on titan episodes"] },
  { mal_id: "38000", title: "Demon Slayer", episodes: 26, score: 8.45, keywords: ["watch demon slayer", "demon slayer episode watch"] },
  { mal_id: "40748", title: "Jujutsu Kaisen", episodes: 24, score: 8.58, keywords: ["watch jujutsu kaisen", "jujutsu kaisen episodes"] },
  { mal_id: "30276", title: "One Punch Man", episodes: 12, score: 8.50, keywords: ["watch one punch man", "one punch man episode"] },
  { mal_id: "1535", title: "Death Note", episodes: 37, score: 8.62, keywords: ["watch death note", "death note anime episodes"] },
  { mal_id: "31964", title: "My Hero Academia", episodes: 13, score: 7.84, keywords: ["watch my hero academia", "my hero academia episodes"] },
  { mal_id: "34572", title: "Black Clover", episodes: 170, score: 8.14, keywords: ["watch black clover", "black clover episodes"] },
  { mal_id: "813", title: "Dragon Ball Z", episodes: 291, score: 8.19, keywords: ["watch dragon ball z", "dragon ball z episodes"] },
  { mal_id: "22319", title: "Tokyo Ghoul", episodes: 12, score: 7.79, keywords: ["watch tokyo ghoul", "tokyo ghoul episodes"] },
  { mal_id: "44511", title: "Chainsaw Man", episodes: 12, score: 8.47, keywords: ["watch chainsaw man", "chainsaw man episode"] },
  { mal_id: "50265", title: "Spy x Family", episodes: 12, score: 8.48, keywords: ["watch spy x family", "spy x family episodes"] },
  { mal_id: "5114", title: "Fullmetal Alchemist: Brotherhood", episodes: 64, score: 9.09, keywords: ["watch fullmetal alchemist brotherhood", "fma brotherhood episodes"] },
  { mal_id: "11757", title: "Sword Art Online", episodes: 25, score: 7.20, keywords: ["watch sword art online", "sao anime episodes"] },
  { mal_id: "4181", title: "Clannad: After Story", episodes: 24, score: 8.93, keywords: ["watch clannad after story", "clannad episodes"] },
  { mal_id: "42249", title: "Tokyo Revengers", episodes: 24, score: 7.86, keywords: ["watch tokyo revengers", "tokyo revengers episodes"] },
  { mal_id: "52299", title: "Solo Leveling", episodes: 12, score: 8.30, keywords: ["watch solo leveling", "solo leveling episodes"] },
];

export const SEO_KEYWORD_PAGES: SeoKeywordPage[] = [
  animeIntent("watch-one-piece-episodes", "One Piece Episode Watch", "Watch One Piece Episodes Online", "One Piece"),
  animeIntent("watch-naruto-episodes", "Watch Naruto Episodes", "Watch Naruto Episodes Online", "Naruto"),
  animeIntent("watch-demon-slayer-online", "Watch Demon Slayer Online", "Watch Demon Slayer Episodes Online", "Demon Slayer"),
  animeIntent("watch-jujutsu-kaisen-online", "Watch Jujutsu Kaisen Online", "Watch Jujutsu Kaisen Episodes", "Jujutsu Kaisen"),
  animeIntent("watch-solo-leveling-online", "Watch Solo Leveling Online", "Watch Solo Leveling Episodes", "Solo Leveling"),
  animeIntent("watch-attack-on-titan-online", "Watch Attack on Titan Online", "Watch Attack on Titan Episodes", "Attack on Titan"),
  animeIntent("watch-death-note-online", "Watch Death Note Online", "Watch Death Note Episodes", "Death Note"),
  animeIntent("watch-bleach-episodes", "Watch Bleach Episodes", "Watch Bleach Anime Online", "Bleach"),
  animeIntent("watch-chainsaw-man-online", "Watch Chainsaw Man Online", "Watch Chainsaw Man Episodes", "Chainsaw Man"),
  animeIntent("watch-black-clover-episodes", "Watch Black Clover Episodes", "Watch Black Clover Anime Online", "Black Clover"),
  {
    slug: "watch-isekai-anime",
    title: "Watch Isekai Anime Online",
    h1: "Watch Isekai Anime Online",
    description: "Find isekai anime to watch online on animeTVplus, including popular fantasy worlds, reincarnation anime, action isekai, and new seasonal episodes.",
    intro: "Browse isekai anime through fast category links, popular picks, and episode pages designed for viewers searching for fantasy-world anime.",
    intent: "genre",
    keywords: ["watch isekai anime", "isekai anime online", "best isekai anime", "isekai anime episodes", "free isekai anime"],
    animeTitles: ["Solo Leveling", "Sword Art Online", "Re:ZERO -Starting Life in Another World-", "That Time I Got Reincarnated as a Slime", "Mushoku Tensei"],
    genreLinks: ["Isekai", "Fantasy", "Action", "Adventure"],
  },
  {
    slug: "top-10-isekai-anime",
    title: "Top 10 Isekai Anime to Watch",
    h1: "Top 10 Isekai Anime to Watch Online",
    description: "A crawlable animeTVplus index for top isekai anime, fantasy anime, reincarnation stories, and popular episode pages.",
    intro: "Use this page as a quick entry point for top isekai anime searches, then open each title or genre page for episodes and related shows.",
    intent: "top-list",
    keywords: ["top 10 isekai anime", "best isekai anime", "isekai anime top list", "watch top isekai anime"],
    animeTitles: ["Solo Leveling", "Sword Art Online", "Re:ZERO -Starting Life in Another World-", "Overlord", "No Game No Life", "Konosuba", "Mushoku Tensei", "That Time I Got Reincarnated as a Slime", "The Rising of the Shield Hero", "Log Horizon"],
    genreLinks: ["Isekai", "Fantasy", "Adventure"],
  },
  {
    slug: "top-10-action-anime",
    title: "Top 10 Action Anime to Watch",
    h1: "Top 10 Action Anime to Watch Online",
    description: "Explore action anime and famous battle shonen titles on animeTVplus, with direct title links and episode discovery pages.",
    intro: "A high-intent action anime index for viewers searching famous anime names, battle arcs, new episodes, and quick watch pages.",
    intent: "top-list",
    keywords: ["top 10 action anime", "best action anime", "watch action anime", "action anime episodes"],
    animeTitles: ["One Piece", "Jujutsu Kaisen", "Demon Slayer", "Attack on Titan", "Naruto: Shippuden", "Bleach", "Chainsaw Man", "Dragon Ball Z", "Black Clover", "One Punch Man"],
    genreLinks: ["Action", "Adventure", "Supernatural"],
  },
  {
    slug: "watch-romance-anime",
    title: "Watch Romance Anime Online",
    h1: "Watch Romance Anime Online",
    description: "Find romance anime, school anime, drama anime, and slice of life anime pages on animeTVplus.",
    intro: "A romance anime search index with direct genre paths and popular anime links for people looking for emotional series and episode pages.",
    intent: "genre",
    keywords: ["watch romance anime", "romance anime online", "best romance anime", "school romance anime"],
    animeTitles: ["Clannad: After Story", "Your Lie in April", "Horimiya", "Kaguya-sama: Love is War", "Fruits Basket"],
    genreLinks: ["Romance", "Drama", "School", "Slice of Life"],
  },
  {
    slug: "watch-anime-episodes-free",
    title: "Watch Anime Episodes Free",
    h1: "Watch Anime Episodes Online",
    description: "Find anime episode pages on animeTVplus with popular anime, free anime discovery, subbed anime, dubbed anime, and new releases.",
    intro: "This page groups high-intent episode searches into direct animeTVplus routes for famous titles, new releases, and anime categories.",
    intent: "episodes",
    keywords: ["watch anime episodes free", "free anime episodes", "anime episode watch", "watch anime online free"],
    animeTitles: ["One Piece", "Naruto", "Bleach", "Demon Slayer", "Jujutsu Kaisen", "Solo Leveling", "Death Note", "Black Clover"],
    categoryLinks: [
      { label: "Free Anime", href: "/free-anime" },
      { label: "New Episodes", href: "/new-releases" },
      { label: "Currently Airing", href: "/airing" },
      { label: "Popular Anime", href: "/popular" },
    ],
  },
  {
    slug: "new-anime-episodes",
    title: "New Anime Episodes",
    h1: "New Anime Episodes Online",
    description: "Track new anime episodes, currently airing anime, and fresh seasonal releases on animeTVplus.",
    intro: "Use this index to reach animeTVplus pages that update around new releases, current airing shows, and seasonal episode discovery.",
    intent: "episodes",
    keywords: ["new anime episodes", "latest anime episodes", "new anime releases", "currently airing anime episodes"],
    animeTitles: ["One Piece", "Solo Leveling", "Jujutsu Kaisen", "Demon Slayer", "My Hero Academia"],
    categoryLinks: [
      { label: "New Releases", href: "/new-releases" },
      { label: "Airing Anime", href: "/airing" },
      { label: "Schedule", href: "/schedule" },
    ],
  },
];

function animeIntent(slug: string, title: string, h1: string, animeTitle: string): SeoKeywordPage {
  return {
    slug,
    title,
    h1,
    description: `${title} on animeTVplus. Open ${animeTitle} title pages, episode lists, and fast watch links for anime streaming discovery.`,
    intro: `This page is built for viewers searching "${title.toLowerCase()}" and related episode-watch keywords. Use the direct links below to open the anime page or start episode 1.`,
    intent: "anime",
    keywords: [`${animeTitle} episode watch`, `watch ${animeTitle} online`, `${animeTitle} episodes`, `${animeTitle} anime streaming`, `free watch ${animeTitle}`],
    animeTitles: [animeTitle],
  };
}

export function keywordPath(slug: string) {
  return `/watch-anime/${slug}`;
}

export function keywordPageBySlug(slug: string) {
  return SEO_KEYWORD_PAGES.find((page) => page.slug === slug);
}

export function famousAnimeByTitle(title: string) {
  const normalized = normalizeTitle(title);
  return FAMOUS_ANIME.find((anime) => normalizeTitle(anime.title) === normalized);
}

export function animeLink(anime: FamousAnime) {
  return animePath(anime, anime.mal_id);
}

export function animeWatchLink(anime: FamousAnime, episode = anime.primaryEpisode ?? 1) {
  return watchPath(anime, anime.mal_id, episode);
}

function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "");
}
