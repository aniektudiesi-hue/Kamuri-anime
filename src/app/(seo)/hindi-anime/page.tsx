import { SeoCategoryPage } from "@/components/seo-category-page";
import { buildPageMetadata } from "@/lib/seo";
import { getSeoCategory } from "@/lib/seo-categories";

const category = getSeoCategory("hindi-anime");

export const revalidate = 1800;
export const metadata = buildPageMetadata({
  title: category.title,
  description: category.description,
  path: category.path,
});

export default function HindiAnimePage() {
  return <SeoCategoryPage slug="hindi-anime" />;
}
