import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import { ProfilePage } from "@/components/profile-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Profile",
  description: "Manage your animeTVplus profile, avatar, and device display name.",
  path: "/profile",
  index: false,
});

export default function ProfileRoute() {
  return (
    <AppShell>
      <ProfilePage />
    </AppShell>
  );
}
