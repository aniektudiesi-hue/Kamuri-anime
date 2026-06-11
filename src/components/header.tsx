import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Search } from "lucide-react";
import { HeaderControls } from "./header-controls";

const nav = [
  { href: "/search?q=New%20Releases", label: "New" },
  { href: "/search?q=Top%20Rated", label: "Popular" },
  { href: "/schedule", label: "Simulcast" },
];

// Genres backed by our catalog (anime_catalog.genres_json)
const genres = [
  "Action", "Adventure", "Comedy", "Drama", "Fantasy",
  "Music", "Romance", "Sci-Fi", "Slice of Life", "Sports",
  "Supernatural", "Thriller", "Mystery", "Mecha", "Ecchi",
  "Horror", "Psychological",
];

function genreHref(g: string) {
  return `/genre/${g.toLowerCase().replace(/\s+/g, "-")}`;
}

export function Header() {
  return (
    // CR header: sticky 60px bar, near-black, border-bottom hairline
    <header className="sticky top-0 z-[100] h-[60px] border-b border-white/[0.06] bg-[#0a0a0d]">
      <div className="mx-auto flex h-[60px] max-w-screen-2xl items-center gap-1 px-4 lg:px-8">
        {/* Logo */}
        <Link href="/" aria-label="animeTVplus home" className="group flex shrink-0 items-center">
          <Image
            src="/logo-full.png"
            alt="animeTVplus"
            width={1495}
            height={402}
            priority
            className="hidden h-[30px] w-auto object-contain drop-shadow-[0_0_18px_rgba(225,29,42,0.22)] sm:block"
          />
          <Image
            src="/logo-icon.png"
            alt="animeTVplus"
            width={410}
            height={410}
            priority
            className="h-9 w-9 object-contain sm:hidden"
          />
        </Link>

        {/* Primary nav */}
        <nav className="ml-4 hidden items-center lg:flex" aria-label="Main Navigation">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative px-3 py-2 text-[15px] font-medium text-white/72 transition-colors duration-150 hover:text-white"
            >
              {item.label}
            </Link>
          ))}

          {/* Categories — pure-CSS hover dropdown (CR "Browse" style) */}
          <div className="group relative">
            <button
              type="button"
              className="flex items-center gap-1 px-3 py-2 text-[15px] font-medium text-white/72 transition-colors duration-150 group-hover:text-white"
            >
              Categories
              <ChevronDown size={16} className="transition-transform duration-200 group-hover:rotate-180" />
            </button>
            <div className="invisible absolute left-0 top-full -translate-y-1 opacity-0 transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
              <div className="mt-1 w-[440px] rounded-xl border border-white/[0.08] bg-[#0b0b0f]/98 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
                <p className="mb-2.5 px-1 text-[11px] font-bold uppercase tracking-widest text-white/30">Genres</p>
                <div className="grid grid-cols-3 gap-x-2 gap-y-0.5">
                  {genres.map((g) => (
                    <Link
                      key={g}
                      href={genreHref(g)}
                      className="rounded-md px-2.5 py-1.5 text-[14px] font-medium text-white/65 transition-colors duration-100 hover:bg-[#c4182a]/15 hover:text-white"
                    >
                      {g}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="flex-1" />

        {/* Search */}
        <Link
          href="/search"
          aria-label="Search anime"
          className="grid h-[40px] w-[40px] place-items-center rounded-full text-white transition-colors duration-150 hover:bg-white/[0.07]"
        >
          <Search size={22} strokeWidth={2.4} />
        </Link>

        <HeaderControls />
      </div>
    </header>
  );
}
