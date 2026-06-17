import { HomePageClient } from "@/components/home-page-client";
import { getHomeInitialData } from "@/lib/home-server";
import { buildPageMetadata } from "@/lib/seo";
import { SITE_DESCRIPTION } from "@/lib/site";

export const revalidate = 1800;
export const metadata = buildPageMetadata({
  title: `animetvplus - animeTVplus Official Site | Watch Anime Online in HD`,
  description: SITE_DESCRIPTION,
  path: "/",
});

export default async function Home() {
  const initialData = await getHomeInitialData();
  return <HomePageClient initialData={initialData} />;
}
