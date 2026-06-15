// Route-transition fallback. Returning null here black-flashed the content area
// on every navigation; a subtle skeleton (matching the dark theme, header/footer
// from the layout stay put) keeps transitions smooth instead of blank.
export default function Loading() {
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6 lg:px-6">
      <div className="h-[42vh] min-h-[260px] w-full animate-pulse rounded-xl bg-white/[0.04]" />
      <div className="mt-8 h-5 w-48 animate-pulse rounded bg-white/[0.05]" />
      <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-white/[0.04]" style={{ animationDelay: `${i * 30}ms` }} />
        ))}
      </div>
    </div>
  );
}
