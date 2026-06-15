const REGION_KEY = "anime-tv-edge-region";
const COUNTRY_KEY = "anime-tv-edge-country";
const ORIGIN_KEY = "anime-tv-edge-origin";

export type RegionId = "india" | "usWest" | "usEast" | "europe";

const REGION_ORIGINS: Record<RegionId, string> = {
  india: "https://animetvplus-stream-backup-india.onrender.com",
  usWest: "https://animetvplus-catalog-api-us-west.onrender.com",
  usEast: "https://animetvplus-catalog-api-us-west.onrender.com", // shares US West until dedicated service exists
  europe: "https://animetvplus-catalog-api-europe.onrender.com",
};

const COUNTRY_TO_REGION: Record<string, RegionId> = {
  // South Asia
  IN: "india", PK: "india", BD: "india", LK: "india", NP: "india", MM: "india", BT: "india", MV: "india", AF: "india",
  // Southeast Asia (closer to India server)
  TH: "india", VN: "india", MY: "india", SG: "india", ID: "india", PH: "india", KH: "india", LA: "india",
  // East Asia
  JP: "usWest", KR: "usWest", TW: "usWest", HK: "usWest",
  // Oceania
  AU: "usWest", NZ: "usWest",
  // North America West
  US: "usWest", CA: "usWest", MX: "usWest",
  // South America
  BR: "usWest", AR: "usWest", CL: "usWest", CO: "usWest", PE: "usWest",
  // Europe
  GB: "europe", DE: "europe", FR: "europe", IT: "europe", ES: "europe", NL: "europe",
  PT: "europe", PL: "europe", SE: "europe", NO: "europe", DK: "europe", FI: "europe",
  BE: "europe", AT: "europe", CH: "europe", IE: "europe", CZ: "europe", RO: "europe",
  HU: "europe", GR: "europe", BG: "europe", HR: "europe", SK: "europe", SI: "europe",
  UA: "europe", RU: "europe", TR: "europe",
  // Middle East
  AE: "europe", SA: "europe", QA: "europe", KW: "europe", BH: "europe", OM: "europe", IL: "europe",
  // Africa
  ZA: "europe", NG: "europe", EG: "europe", KE: "europe", MA: "europe", GH: "europe",
};

const CONTINENT_TO_REGION: Record<string, RegionId> = {
  AS: "india",
  NA: "usWest",
  SA: "usWest",
  OC: "usWest",
  EU: "europe",
  AF: "europe",
};

export function regionFromCountry(countryCode: string): RegionId {
  const code = countryCode.trim().toUpperCase();
  return COUNTRY_TO_REGION[code] || "india";
}

export function regionFromContinent(continent: string): RegionId {
  return CONTINENT_TO_REGION[continent.trim().toUpperCase()] || "india";
}

export function originForRegion(region: RegionId): string {
  return REGION_ORIGINS[region] || REGION_ORIGINS.india;
}

export function detectServerRegion(headers: Headers): { region: RegionId; origin: string } {
  const country = headers.get("x-vercel-ip-country") || "";
  const continent = headers.get("x-vercel-ip-continent") || "";
  const region = country ? regionFromCountry(country) : continent ? regionFromContinent(continent) : "india";
  return { region, origin: originForRegion(region) };
}

export type EdgeSession = {
  region?: string;
  country?: string;
  colo?: string;
  continent?: string;
  origin?: string;
};

export function storedCatalogRegion(): RegionId {
  if (typeof window === "undefined") return "india";
  const stored = window.localStorage.getItem(REGION_KEY);
  if (stored && stored in REGION_ORIGINS) return stored as RegionId;
  return "india";
}

export function storedCountry() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(COUNTRY_KEY) || "";
}

export function storedCatalogOrigin(): string {
  if (typeof window === "undefined") return REGION_ORIGINS.india;
  return window.localStorage.getItem(ORIGIN_KEY) || REGION_ORIGINS.india;
}

export async function loadEdgeSession(): Promise<EdgeSession | null> {
  if (typeof window === "undefined") return null;
  try {
    const r = await fetch("/api/geo", { cache: "no-store" });
    if (!r.ok) return null;
    const data = await r.json();
    const country = data.country || "";
    const continent = data.continent || "";
    const region = country ? regionFromCountry(country) : continent ? regionFromContinent(continent) : "india";
    const origin = originForRegion(region);
    window.localStorage.setItem(REGION_KEY, region);
    window.localStorage.setItem(ORIGIN_KEY, origin);
    if (country) window.localStorage.setItem(COUNTRY_KEY, country);
    return { region, country, continent, origin };
  } catch {
    return null;
  }
}

export function catalogRegionHeaders(): Record<string, string> {
  const region = storedCatalogRegion();
  return region ? { "x-atv-catalog-region": region } : {};
}

export function countryLabel(countryCode: string) {
  const code = countryCode.trim().toUpperCase();
  if (!code) return "";
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

export function regionLabel(region: string) {
  const labels: Record<string, string> = { india: "India", usWest: "US West", usEast: "US East", europe: "Europe" };
  return labels[region.trim()] || "";
}

export function originLabel(origin: string) {
  const host = origin.trim().toLowerCase();
  if (!host) return "";
  if (host.includes("127.0.0.1") || host.includes("localhost")) return "";
  if (host.includes("india")) return "India";
  if (host.includes("us-west") || host.includes("usa-west") || host.includes("america-west")) return "US West";
  if (host.includes("us-east") || host.includes("usa-east") || host.includes("america-east")) return "US East";
  if (host.includes("europe") || host.includes("eu-")) return "Europe";
  if (host.includes("onrender.com")) return "Render";
  return host.replace(/^https?:\/\//, "").split("/")[0];
}
