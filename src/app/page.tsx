import { Suspense } from "react";
import { HomePageClient } from "@/components/home-page-client";
import { getHomeInitialData } from "@/lib/home-server";
import { buildPageMetadata } from "@/lib/seo";
import { SITE_DESCRIPTION } from "@/lib/site";
import type { HomeInitialData } from "@/lib/types";

export const revalidate = 1800;
export const metadata = buildPageMetadata({
  title: `animetvplus - animeTVplus Official Site | Watch Anime Online in HD`,
  description: SITE_DESCRIPTION,
  path: "/",
});

const EMPTY_HOME: HomeInitialData = {
  banners: [], thumbnails: [], recent: [], topRated: [], popular: [],
  famousNew: [], romance: [], isekai: [], sports: [], selfImprovement: [],
  healing: [], schedule: [], generatedAt: "",
};

async function HomeData() {
  const initialData = await getHomeInitialData();
  return <HomePageClient initialData={initialData} />;
}

export default function Home() {
  return (
    <Suspense fallback={<HomePageClient initialData={EMPTY_HOME} />}>
      <HomeData />
    </Suspense>
  );
}
