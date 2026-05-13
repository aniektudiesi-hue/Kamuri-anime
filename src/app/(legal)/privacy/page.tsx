import { LegalPage } from "@/components/legal-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Privacy Policy",
  description: "Privacy policy for animeTv, including account, watch history, and local download information.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="May 12, 2026">
      <p>
        animeTv stores account-related watch history and watchlist data only when a user signs in. Offline downloads are saved on the user&apos;s own browser or device.
      </p>
      <p>
        We use basic technical data such as browser requests and logs to keep the website working, improve performance, and protect the service from abuse.
      </p>
      <p>
        We do not sell personal information. Users can clear history from the app and remove saved items from their library.
      </p>
    </LegalPage>
  );
}
