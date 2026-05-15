"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Heart, Home, MessageCircle, Search } from "lucide-react";
import { openChat } from "@/lib/chat";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { label: "Chat", icon: MessageCircle, action: () => openChat("global") },
  { href: "/schedule", label: "Schedule", icon: CalendarDays },
  { href: "/watchlist", label: "Watchlist", icon: Heart },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.08] bg-[#05060a]/94 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_55px_rgba(0,0,0,0.42)] backdrop-blur-2xl sm:hidden">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => {
          const active = "href" in item && item.href ? (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) : false;
          const Icon = item.icon;
          return "href" in item && item.href ? (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black transition-colors",
                active
                  ? "bg-[#e11d48]/14 text-white ring-1 ring-[#e11d48]/20"
                  : "text-white/70 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              <Icon size={18} strokeWidth={active ? 2.6 : 2.2} />
              <span>{item.label}</span>
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              aria-label={item.label}
              onClick={item.action}
              className="flex min-h-12 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-black text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Icon size={18} strokeWidth={2.2} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
