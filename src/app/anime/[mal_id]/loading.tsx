export default function AnimeDetailLoading() {
  return (
    <div className="min-h-screen">
      {/* Hero banner skeleton */}
      <div className="relative h-[45vh] min-h-[280px] w-full animate-pulse bg-white/[0.04]" />
      <div className="mx-auto max-w-screen-2xl px-4 py-6 lg:px-8">
        <div className="flex gap-6">
          {/* Poster */}
          <div className="hidden w-44 shrink-0 sm:block">
            <div className="aspect-[2/3] animate-pulse rounded-xl bg-white/[0.06]" />
          </div>
          <div className="flex-1 space-y-3 pt-2">
            <div className="h-8 w-3/4 animate-pulse rounded bg-white/[0.07]" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-white/[0.04]" />
            <div className="flex gap-2 pt-1">
              {[80, 60, 70].map((w, i) => (
                <div key={i} className="h-6 animate-pulse rounded-full bg-white/[0.05]" style={{ width: w }} />
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <div className="h-10 w-32 animate-pulse rounded-lg bg-white/[0.07]" />
              <div className="h-10 w-28 animate-pulse rounded-lg bg-white/[0.04]" />
            </div>
          </div>
        </div>
        {/* Episode grid skeleton */}
        <div className="mt-8 h-5 w-40 animate-pulse rounded bg-white/[0.05]" />
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
          {Array.from({ length: 20 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded bg-white/[0.04]" style={{ animationDelay: `${i * 20}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
