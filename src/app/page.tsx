import { HomePageClient } from "@/components/home-page-client";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { getHomeInitialData } from "@/lib/home-server";
import { SITE_MAINTENANCE } from "@/lib/maintenance";
import { buildPageMetadata } from "@/lib/seo";
import { SITE_DESCRIPTION } from "@/lib/site";

export const revalidate = 60;
export const metadata = buildPageMetadata({
  title: `animetvplus - animeTVplus Official Site | Watch Anime Online in HD`,
  description: SITE_DESCRIPTION,
  path: "/",
});

export default async function Home() {
  if (SITE_MAINTENANCE) {
    return <MaintenanceGate />;
  }

  const initialData = await getHomeInitialData();
  return <HomePageClient initialData={initialData} />;
}
