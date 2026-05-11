export function PlayerBuffering({ label = "" }: { label?: string }) {
  return (
    <div className="grid aspect-video w-full place-items-center rounded-md bg-black/88">
      <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/35 p-3 text-sm font-semibold text-white shadow-xl backdrop-blur-xl">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/15 border-t-white/90" />
        {label ? <span>{label}</span> : null}
      </div>
    </div>
  );
}
