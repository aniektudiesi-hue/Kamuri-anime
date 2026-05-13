import { SeoCategoryPage } from "@/components/seo-category-page";
import { buildPageMetadata } from "@/lib/seo";
import { getSeoCategory } from "@/lib/seo-categories";

const category = getSeoCategory("free-anime");

export const revalidate = 900;
export const metadata = buildPageMetadata({
  title: category.title,
  description: category.description,
  path: category.path,
});

export default function FreeAnimePage() {
  return <SeoCategoryPage slug="free-anime" />;
}
