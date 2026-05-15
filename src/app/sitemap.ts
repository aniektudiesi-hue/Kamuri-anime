import type { MetadataRoute } from "next";
import { staticSitemapRoutes } from "@/lib/sitemap-data";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return staticSitemapRoutes();
}
