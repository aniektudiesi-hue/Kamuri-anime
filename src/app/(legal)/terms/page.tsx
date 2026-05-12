import { LegalPage } from "@/components/legal-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Terms of Use",
  description: "Terms of use for animeTv.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="May 12, 2026">
      <p>
        animeTv is provided for personal browsing and anime discovery. Users are responsible for using the site in a lawful way in their location.
      </p>
      <p>
        The service may change, pause, or remove features when needed for performance, security, or compliance.
      </p>
      <p>
        Do not abuse the service, attempt to disrupt playback, scrape aggressively, or misuse account features.
      </p>
    </LegalPage>
  );
}
