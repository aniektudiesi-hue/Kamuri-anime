import { LegalPage } from "@/components/legal-page";
import { buildPageMetadata, safeJsonLd } from "@/lib/seo";
import { absoluteUrl, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata = buildPageMetadata({
  title: "Licensing, Safety and Content Access",
  description:
    "Learn how animeTv operates with licensed anime access, safe viewing standards, content review, privacy-conscious playback, and rights-holder support.",
  path: "/licensing",
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Licensing, Safety and Content Access",
  url: absoluteUrl("/licensing"),
  isPartOf: {
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
  },
  about: [
    "licensed anime streaming access",
    "safe anime viewing",
    "rights holder support",
    "content safety",
    "secure playback",
  ],
};

export default function LicensingPage() {
  return (
    <LegalPage title="Licensing, Safety and Content Access" updated="May 15, 2026">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />
      <p>
        animeTv is operated as a licensed anime streaming and discovery platform. The service is built for viewers who want a
        safe, stable, and easy way to discover anime titles, open episode pages, and watch supported streams through the
        animeTv playback experience.
      </p>
      <p>
        Content availability on animeTv is based on authorized access, title metadata, regional availability, and internal
        content review. We do not present adult-restricted titles as part of the standard animeTv streaming catalog, and we
        may restrict or remove pages that do not meet our safety and rights requirements.
      </p>
      <p>
        The animeTv player is designed for safe viewing with HTTPS pages, secure browser playback, subtitle support, watch
        history controls, and clear episode navigation. Account features such as watchlist and history are designed to help
        viewers continue supported titles without exposing unnecessary personal information in public pages.
      </p>
      <p>
        Rights holders, studios, distributors, or authorized representatives can contact animeTv for title review, licensing
        clarification, metadata correction, regional availability updates, or removal requests. We review reasonable requests
        and update the service when a rights or safety issue is confirmed.
      </p>
      <p>
        animeTv also maintains public policies for privacy, terms of use, and copyright review so that viewers and search
        engines can understand how the platform is operated.
      </p>
    </LegalPage>
  );
}
