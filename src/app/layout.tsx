import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { absoluteUrl, SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    default: `animetvplus - animeTVplus Official Anime Streaming Site | animetv plus`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/logo.svg", type: "image/svg+xml", sizes: "any" },
    ],
    shortcut: "/favicon.svg",
    apple: [{ url: "/apple-icon.svg", type: "image/svg+xml", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: `animetvplus - animeTVplus Official Anime Streaming Site | animetv plus`,
    description: SITE_DESCRIPTION,
    images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `animetvplus - animeTVplus Official Anime Streaming Site | animetv plus`,
    description: SITE_DESCRIPTION,
    images: [absoluteUrl("/opengraph-image")],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "7WFPDOOdLeDUOVWw4kQv-XQHApnIl_Lwl34RbwzvWCo",
  },
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE_URL}/#website`,
  name: SITE_NAME,
  alternateName: [
    "animeTVplus",
    "animetvplus",
    "animetv plus",
    "anime tv plus",
    "anime tvplus",
    "animeTVplus official",
    "animetvplus.xyz",
    "animetvplus anime",
  ],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  inLanguage: ["en", "ja"],
  keywords: SITE_KEYWORDS.join(", "),
  about: [
    "free anime streaming",
    "subbed anime",
    "dubbed anime",
    "new anime releases",
    "monthly anime schedule",
  ],
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: SITE_NAME,
  legalName: "animeTVplus",
  alternateName: ["animetvplus", "anime tv plus", "animetvplus.xyz"],
  url: SITE_URL,
  logo: absoluteUrl("/logo.svg"),
  image: absoluteUrl("/logo.svg"),
  sameAs: [SITE_URL, `${SITE_URL}/licensing`, `${SITE_URL}/schedule`, `${SITE_URL}/free-anime`],
  publishingPrinciples: absoluteUrl("/licensing"),
  knowsAbout: [
    "licensed anime streaming",
    "anime episode discovery",
    "safe anime playback",
    "subbed anime",
    "dubbed anime",
    "monthly anime release schedules",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full antialiased", "font-sans")}
    >
      <head>
        <link rel="preconnect" href="https://anime-search-api-burw.onrender.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://anime-search-api-burw.onrender.com" />
        <link rel="preconnect" href="https://anime-tv-stream-proxy.kamuri-anime.workers.dev" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.animetvplus.xyz" />
        <link rel="preconnect" href="https://s4.anilist.co" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://cdn.myanimelist.net" />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([websiteJsonLd, organizationJsonLd]).replace(/</g, "\\u003c"),
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
