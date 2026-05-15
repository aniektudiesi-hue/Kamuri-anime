import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AuthForm } from "@/components/auth-form";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Sign In",
  description: "Sign in to animeTVplus to sync watch history and watchlist.",
  path: "/login",
  index: false,
});

export default function LoginPage() {
  return (
    <AppShell>
      <AuthForm mode="login" />
    </AppShell>
  );
}
