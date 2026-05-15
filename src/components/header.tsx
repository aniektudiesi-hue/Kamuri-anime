import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { HeaderControls } from "./header-controls";

const nav = [
  { href: "/popular", label: "Browse" },
  { href: "/new-releases", label: "New Releases" },
  { href: "/top-rated", label: "Top Rated" },
  { href: "/schedule", label: "Schedule" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50">
      <div className="border-b border-white/[0.075] bg-[#05060a]/90 shadow-[0_18px_55px_rgba(0,0,0,0.32)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[#05060a]/76">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-4 sm:h-[72px] lg:px-6">
          <Link href="/" aria-label="animeTv home" className="group flex shrink-0 items-center gap-3">
            <span className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.045] shadow-[0_18px_40px_rgba(0,0,0,0.38)] transition group-hover:border-[#e11d48]/40">
              <Image src="/logo.svg" alt="" width={34} height={34} priority className="drop-shadow-[0_0_22px_rgba(225,29,72,0.32)]" />
            </span>
            <span className="hidden text-[18px] font-black tracking-tight text-white sm:block">
              anime<span className="text-[#e11d48]">Tv</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 lg:flex">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="relative rounded-xl px-4 py-2 text-sm font-bold text-white/48 transition hover:bg-white/[0.055] hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="mx-auto hidden max-w-2xl flex-1 sm:block">
            <Link
              href="/search"
              aria-label="Search anime"
              className="flex h-11 items-center gap-2 rounded-full border border-white/[0.075] bg-[#0d1020]/86 px-4 text-[15px] font-semibold text-white/28 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[#e11d48]/35 hover:bg-[#111421]/92 hover:text-white/55 sm:h-12"
            >
              <Search size={16} className="shrink-0 text-white/32" />
              <span>Search anime...</span>
            </Link>
          </div>

          <HeaderControls />

          <Link
            href="/search"
            aria-label="Search anime"
            className="ml-auto grid h-10 w-10 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.045] text-white/70 transition hover:bg-white/[0.08] hover:text-white sm:hidden"
          >
            <Search size={18} />
          </Link>
        </div>
      </div>
    </header>
  );
}
