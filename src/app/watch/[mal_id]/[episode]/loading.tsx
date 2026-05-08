import { AppShell } from "@/components/app-shell";
import { PlayerBuffering } from "@/components/player-buffering";

export default function WatchLoading() {
  return (
    <AppShell>
      <section className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-4 h-8 w-80 animate-pulse rounded bg-panel-strong" />
        <PlayerBuffering label="Preparing episode" />
      </section>
    </AppShell>
  );
}
