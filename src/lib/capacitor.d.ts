// Minimal ambient declarations for Capacitor plugins used in native.ts.
// The actual packages are only present in the Android build; on the web the
// dynamic imports are wrapped in try/catch so missing modules are harmless.
// These stubs satisfy TypeScript without requiring the packages to be installed
// in the Next.js / Vercel web build.

declare module "@capacitor/splash-screen" {
  export const SplashScreen: {
    hide(options?: { fadeOutDuration?: number }): Promise<void>;
  };
}

declare module "@capacitor/status-bar" {
  export const StatusBar: {
    setStyle(options: { style: unknown }): Promise<void>;
    setBackgroundColor(options: { color: string }): Promise<void>;
  };
  export const Style: {
    Dark: unknown;
    Light: unknown;
    Default: unknown;
  };
}

declare module "@capacitor/app" {
  export const App: {
    addListener(
      event: string,
      handler: (data: { canGoBack?: boolean }) => void,
    ): Promise<{ remove(): void }>;
    exitApp(): void;
  };
}
