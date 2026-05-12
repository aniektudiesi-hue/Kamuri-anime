import { HomePageClient } from "@/components/home-page-client";
import { getHomeInitialData } from "@/lib/home-server";

export const revalidate = 1800;

export default async function Home() {
  const initialData = await getHomeInitialData();
  return <HomePageClient initialData={initialData} />;
}
