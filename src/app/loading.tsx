import { AppShell } from "@/components/app-shell";
import { CardSkeleton } from "@/components/anime-row";

export default function Loading() {
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="h-[420px] animate-pulse rounded-md bg-panel-strong" />
        <div className="mt-8 h-7 w-40 animate-pulse rounded bg-panel-strong" />
        <div className="mt-5 flex gap-4 overflow-hidden">
          {Array.from({ length: 8 }).map((_, index) => <CardSkeleton key={index} />)}
        </div>
      </div>
    </AppShell>
  );
}
