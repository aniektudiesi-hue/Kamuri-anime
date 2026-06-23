import Link from "next/link";

const quickLinks = [
  { href: "/popular", label: "Popular" },
  { href: "/new-releases", label: "New Releases" },
  { href: "/top-rated", label: "Top Rated" },
  { href: "/schedule", label: "Schedule" },
  { href: "/help", label: "Help" },
  { href: "/dmca", label: "DMCA" },
];

const genreLinks = ["Action", "Adventure", "Fantasy", "Isekai", "Romance", "Comedy", "Drama", "Sports", "Supernatural"];

export function SeoFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-black px-4 py-8 text-white/58 sm:px-8">
      <div className="mx-auto grid max-w-7xl gap-7 md:grid-cols-[1.05fr_0.95fr] lg:grid-cols-[1.1fr_0.65fr_0.85fr]">
        <section className="max-w-xl">
          <h2 className="text-base font-black text-white">animeTVplus</h2>
          <p className="mt-3 text-sm leading-6">
            Fast anime discovery, episode navigation, watch history, schedules, and mobile-first playback on
            animetvplus.xyz.
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded border border-white/[0.08] px-2.5 py-1 text-white/62">HTTPS playback</span>
            <span className="rounded border border-white/[0.08] px-2.5 py-1 text-white/62">Sub + dub</span>
            <span className="rounded border border-white/[0.08] px-2.5 py-1 text-white/62">Mobile ready</span>
          </div>
        </section>

        <nav aria-label="AnimeTVplus pages">
          <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-white/82">Explore</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {quickLinks.map((link) => (
              <Link key={link.href} href={link.href} className="text-sm font-bold text-white/58 transition hover:text-white">
                {link.label}
              </Link>
            ))}
          </div>
        </nav>

        <nav aria-label="Anime genre pages">
          <h2 className="text-[11px] font-black uppercase tracking-[0.22em] text-white/82">Genres</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {genreLinks.map((genre) => (
              <Link
                key={genre}
                href={`/genre/${encodeURIComponent(genre)}`}
                className="rounded border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-xs font-bold text-white/62 transition hover:border-[#cf2442]/35 hover:text-white"
              >
                {genre}
              </Link>
            ))}
          </div>
        </nav>
      </div>
      <div className="mx-auto mt-7 flex max-w-7xl flex-col gap-2 border-t border-white/[0.055] pt-5 text-xs font-semibold text-white/38 sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} animeTVplus. All rights reserved.</span>
        <span>Official domain: animetvplus.xyz</span>
      </div>
    </footer>
  );
}
