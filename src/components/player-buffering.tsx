export function PlayerBuffering({ label = "Buffering stream" }: { label?: string }) {
  return (
    <div className="grid aspect-video w-full place-items-center rounded-md bg-black/88">
      <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/55 px-4 py-2 text-sm font-semibold text-white shadow-xl backdrop-blur">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/25 border-t-accent-2" />
        <span>{label}</span>
      </div>
    </div>
  );
}
