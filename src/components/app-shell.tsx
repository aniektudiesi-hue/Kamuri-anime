import Image from "next/image";
import Link from "next/link";
import { Header } from "./header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}

const AZ = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function Footer() {
  return (
    <footer className="mt-12 border-t border-white/[0.055] bg-[#06070d]">
      {/* A-Z quick browse */}
      <div className="border-b border-white/[0.04] py-4">
        <div className="mx-auto max-w-screen-2xl px-4 lg:px-6">
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-2 text-[10px] font-bold uppercase tracking-widest text-white/25">A-Z</span>
            {AZ.map((c) => (
              <Link
                key={c}
                href={`/search?q=${c === "#" ? "0" : c}`}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                {c}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-screen-2xl px-4 py-10 lg:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <Image src="/logo.svg" alt="animeTv" width={28} height={28} />
              <span className="text-sm font-black tracking-tight text-white">
                anime<span className="text-[#c8223d]">Tv</span>
              </span>
            </Link>
            <p className="mt-3 max-w-[200px] text-[12px] leading-relaxed text-white/30">
              Stream thousands of anime titles in HD quality. Sub &amp; dub, instant playback.
            </p>
            <p className="mt-4 text-[11px] text-white/15">
              Disclaimer: This site does not store any files on its server.
            </p>
          </div>

          {/* Browse */}
          <div>
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-white/25">Browse</h3>
            <ul className="space-y-2">
              {[
                { label: "New Releases", href: "/new-releases" },
                { label: "Popular", href: "/popular" },
                { label: "Top Rated", href: "/top-rated" },
                { label: "Currently Airing", href: "/airing" },
                { label: "Schedule", href: "/schedule" },
                { label: "Movies", href: "/search?q=movie" },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[12px] text-white/40 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Genres */}
          <div>
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-white/25">Genres</h3>
            <ul className="space-y-2">
              {["Action", "Adventure", "Comedy", "Fantasy", "Romance", "Isekai", "Slice of Life", "Horror"].map(
                (g) => (
                  <li key={g}>
                    <Link
                      href={`/genre/${encodeURIComponent(g)}`}
                      className="text-[12px] text-white/40 transition-colors hover:text-white"
                    >
                      {g}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </div>

          {/* Account */}
          <div>
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-widest text-white/25">Account</h3>
            <ul className="space-y-2">
              {[
                { label: "My Watchlist", href: "/watchlist" },
                { label: "Watch History", href: "/history" },
                { label: "Sign In", href: "/login" },
                { label: "Register", href: "/register" },
              ].map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="text-[12px] text-white/40 transition-colors hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-white/[0.04] pt-6 sm:flex-row">
          <p className="text-[11px] text-white/20">
            © {new Date().getFullYear()} animeTv. All Rights Reserved.
          </p>
          <div className="flex items-center gap-4">
            {[
              { label: "Privacy Policy", href: "/privacy" },
              { label: "Terms of Use", href: "/terms" },
              { label: "DMCA", href: "/dmca" },
            ].map((link) => (
              <Link key={link.label} href={link.href} className="text-[11px] text-white/20 transition-colors hover:text-white/50">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-5 border-t border-white/[0.04] pt-5">
          <p className="max-w-4xl text-[12px] leading-6 text-white/24">
            Popular anime pages on animeTv include currently airing anime, new release anime, top rated anime, anime genres,
            and a weekly anime release schedule. These internal links help viewers and search engines discover the site naturally.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "Popular Anime", href: "/popular" },
              { label: "New Release Anime", href: "/new-releases" },
              { label: "Currently Airing Anime", href: "/airing" },
              { label: "Top Rated Anime", href: "/top-rated" },
              { label: "Anime Schedule", href: "/schedule" },
            ].map((link) => (
              <Link key={link.href} href={link.href} className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/30 hover:text-white/60">
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
