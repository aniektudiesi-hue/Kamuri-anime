import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Admin Control",
  description: "Private animeTVplus owner dashboard for users, logins, visitors, activity, and search visibility.",
  path: "/8527330761",
  index: false,
});

export default function AdminPrivatePage() {
  return <AdminDashboard />;
}
