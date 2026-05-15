import { LegalPage } from "@/components/legal-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "Privacy Policy",
  description: "Privacy policy for animeTVplus, including account, watch history, and local download information.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="May 13, 2026">
      <p>
        animeTVplus stores account-related watch history and watchlist data only when a user signs in. Offline downloads are saved on the user&apos;s own browser or device.
      </p>
      <p>
        We use basic technical data such as page visits, login events, IP address, browser user agent, approximate device type, referrer, approximate location from hosting/CDN headers when available, timezone, language, and screen size to keep the website working, understand unique visits, improve performance, and protect the service from abuse.
      </p>
      <p>
        This operational analytics data is available only inside the private owner admin dashboard and is not sold.
      </p>
      <p>
        We do not sell personal information. Users can clear history from the app and remove saved items from their library.
      </p>
    </LegalPage>
  );
}
