import { AppShell } from "@/components/app-shell";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <AppShell>
      <section className="mx-auto max-w-3xl px-4 py-10">
        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.28em] text-[#cf2442]">animeTVplus</p>
        <h1 className="text-3xl font-black text-white">{title}</h1>
        <p className="mt-2 text-sm text-white/35">Last updated: {updated}</p>
        <div className="mt-7 space-y-5 text-sm leading-7 text-white/52">
          {children}
        </div>
      </section>
    </AppShell>
  );
}
