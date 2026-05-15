import { LegalPage } from "@/components/legal-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "DMCA",
  description: "DMCA and copyright contact information for animeTVplus.",
  path: "/dmca",
});

export default function DmcaPage() {
  return (
    <LegalPage title="DMCA" updated="May 12, 2026">
      <p>
        animeTVplus does not claim ownership of third-party anime titles, artwork, or trademarks shown for identification and discovery.
      </p>
      <p>
        If you are a rights holder and believe a page should be reviewed, provide the title, affected URL, proof of ownership, and the requested action.
      </p>
      <p>
        We review reasonable copyright requests and may remove or update pages when appropriate.
      </p>
    </LegalPage>
  );
}
