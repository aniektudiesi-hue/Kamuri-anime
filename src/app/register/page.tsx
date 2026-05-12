import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { AuthForm } from "@/components/auth-form";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Create Account",
  description: "Create an animeTv account to sync watch history and watchlist.",
  path: "/register",
  index: false,
});

export default function RegisterPage() {
  return (
    <AppShell>
      <AuthForm mode="register" />
    </AppShell>
  );
}
