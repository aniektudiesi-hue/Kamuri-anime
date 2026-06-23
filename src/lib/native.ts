"use client";

// Thin bridge around Capacitor so the rest of the app can stay platform-agnostic.
// Everything degrades gracefully on the plain web (no Capacitor present).

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** True only inside the packaged Android/iOS app (WebView), false on the web. */
export function isNativeApp(): boolean {
  const c = cap();
  return Boolean(c?.isNativePlatform?.());
}

export function nativePlatform(): string {
  return cap()?.getPlatform?.() ?? "web";
}

/** Hide the native splash screen (no-op on web). */
export async function hideNativeSplash(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    /* plugin not available */
  }
}

/** Lock the status bar to the dark brand chrome (no-op on web). */
export async function setupStatusBar(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const [{ StatusBar, Style }] = await Promise.all([import("@capacitor/status-bar")]);
    await StatusBar.setStyle({ style: Style.Dark });
    if (nativePlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#000000" });
    }
  } catch {
    /* plugin not available */
  }
}

/**
 * Wire the hardware/gesture back button to SPA history so navigation feels
 * native: go back through in-app history, and only exit at the app root.
 * Returns a cleanup function.
 */
export function setupHardwareBack(): () => void {
  let removed = false;
  let cleanup: (() => void) | undefined;
  if (isNativeApp()) {
    import("@capacitor/app")
      .then(({ App }) => {
        if (removed) return;
        const handle = App.addListener("backButton", ({ canGoBack }) => {
          // Walk back through in-app history; only leave the app at the root.
          const atRoot = window.location.pathname === "/";
          if ((canGoBack || window.history.length > 1) && !atRoot) {
            window.history.back();
          } else {
            App.exitApp();
          }
        });
        cleanup = () => {
          handle.then((h) => h.remove()).catch(() => undefined);
        };
      })
      .catch(() => undefined);
  }
  return () => {
    removed = true;
    cleanup?.();
  };
}
