const EDGE_SESSION_URL =
  process.env.NEXT_PUBLIC_EDGE_SESSION_URL ||
  "https://anime-tv-stream-proxy.animetvplus-stream.workers.dev/api/edge-session";

const REGION_KEY = "anime-tv-edge-region";
const COUNTRY_KEY = "anime-tv-edge-country";
const ORIGIN_KEY = "anime-tv-edge-origin";
const VALID_REGIONS = new Set(["india", "usWest", "usEast", "europe"]);

export type EdgeSession = {
  region?: string;
  country?: string;
  colo?: string;
  continent?: string;
  origin?: string;
};

export function storedCatalogRegion() {
  if (typeof window !== "undefined") window.localStorage.setItem(REGION_KEY, "india");
  return "india";
}

export function storedCountry() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(COUNTRY_KEY) || "";
}

export function storedCatalogOrigin() {
  if (typeof window !== "undefined") window.localStorage.setItem(ORIGIN_KEY, "https://animetvplus-stream-backup-india.onrender.com");
  return "https://animetvplus-stream-backup-india.onrender.com";
}

export async function loadEdgeSession(): Promise<EdgeSession | null> {
  if (typeof window === "undefined") return null;
  try {
    const session: EdgeSession = {
      region: "india",
      country: window.localStorage.getItem(COUNTRY_KEY) || "",
      origin: "https://animetvplus-stream-backup-india.onrender.com",
    };
    window.localStorage.setItem(REGION_KEY, "india");
    window.localStorage.setItem(ORIGIN_KEY, session.origin || "");
    return session;
  } catch {
    return null;
  }
}

export function catalogRegionHeaders(): Record<string, string> {
  const region = storedCatalogRegion();
  return region ? { "x-atv-catalog-region": region } : {};
}

function isCatalogRegion(region: string) {
  return VALID_REGIONS.has(region.trim());
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
  const value = region.trim();
  if (!isCatalogRegion(value)) return "";
  if (value === "india") return "India";
  if (value === "usWest") return "US West";
  if (value === "usEast") return "US East";
  if (value === "europe") return "Europe";
  return "";
}

export function originLabel(origin: string) {
  const host = origin.trim().toLowerCase();
  if (!host) return "";
  if (host.includes("127.0.0.1") || host.includes("localhost")) return "";
  if (host.includes("india")) return "India Render";
  if (host.includes("us-west") || host.includes("usa-west") || host.includes("america-west")) return "US West Render";
  if (host.includes("us-east") || host.includes("usa-east") || host.includes("america-east")) return "US East Render";
  if (host.includes("europe") || host.includes("eu-")) return "Europe Render";
  if (host.includes("onrender.com")) return "Render";
  return host.replace(/^https?:\/\//, "").split("/")[0];
}
