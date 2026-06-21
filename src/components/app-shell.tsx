import { Header } from "./header";
import { MobileBottomNavGate } from "./mobile-bottom-nav-gate";
import { BootLoader } from "./boot-loader";

export function AppShell({
  children,
  hideMobileChrome = false,
  hideMobileBottomNav,
}: {
  children: React.ReactNode;
  hideMobileChrome?: boolean;
  hideMobileBottomNav?: boolean;
}) {
  const shouldHideBottomNav = hideMobileBottomNav ?? hideMobileChrome;
  return (
    <>
      <BootLoader />
      <div className={hideMobileChrome ? "hidden sm:block" : ""}>
        <Header />
      </div>
      <main className={hideMobileChrome ? "pb-0 sm:pb-0" : "pb-20 sm:pb-0"}>{children}</main>
      <div className={hideMobileChrome ? "hidden sm:block" : ""}>
        <Footer />
      </div>
      {shouldHideBottomNav ? null : <MobileBottomNavGate />}
    </>
  );
}

function Footer() {
  return (
    <footer className="border-t border-white/[0.055] bg-black py-6 text-center">
      <p className="text-[13px] text-white/55">
        Support us and follow us at{" "}
        <span className="font-semibold text-white/80">animetvplus_official</span>
        {" "}for updates
      </p>
      <a href="/help" className="mt-2 inline-block text-[13px] font-semibold text-[#c4182a] transition hover:text-[#d8273a]">
        Help &amp; Support
      </a>
    </footer>
  );
}
