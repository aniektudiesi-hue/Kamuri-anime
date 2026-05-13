import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Admin Control",
  description: "Private animeTv owner dashboard for users, logins, visitors, and search visibility.",
  path: "/admin",
  index: false,
});

export default function AdminPage() {
  return <AdminDashboard />;
}
