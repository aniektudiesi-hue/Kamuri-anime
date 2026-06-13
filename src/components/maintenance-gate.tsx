import Image from "next/image";
import { Kairo } from "@/components/mascot/kairo";

/**
 * MaintenanceGate — full-screen "under maintenance" overlay.
 * OFF by default now that the Turso migration + backend/worker fixes are live.
 * Hard-disabled for production. Re-enable intentionally before using this gate again.
 */
const MAINTENANCE_ON = false;

export function MaintenanceGate() {
  if (!MAINTENANCE_ON) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black px-6 text-center">
      <Image src="/logo-full.png" alt="animeTVplus" width={1495} height={402} priority className="h-10 w-auto object-contain" />
      <Kairo mood="sleepy" size={180} priority className="mt-8" />
      <h1 className="mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl">
        We&apos;ll be right back
      </h1>
      <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/55">
        animeTV<span className="text-[#c4182a]">plus</span> is getting an upgrade. Kairo&apos;s putting the finishing touches on something great — check back soon.
      </p>
      <div className="mt-7 h-1 w-44 overflow-hidden rounded-full bg-white/[0.08]">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-[#c4182a]" />
      </div>
    </div>
  );
}
