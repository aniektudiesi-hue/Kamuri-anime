import { SeoCategoryPage } from "@/components/seo-category-page";
import { buildPageMetadata } from "@/lib/seo";
import { getSeoCategory } from "@/lib/seo-categories";

const category = getSeoCategory("popular");

export const revalidate = 1800;
export const metadata = buildPageMetadata({
  title: category.title,
  description: category.description,
  path: category.path,
});

export default function PopularPage() {
  return <SeoCategoryPage slug="popular" />;
}
