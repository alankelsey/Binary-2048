import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { DevNav } from "@/app/dev-nav";
import { AuthShell } from "@/app/auth-shell";
import { isDevNavEnabled } from "@/lib/binary2048/dev-nav";

const siteUrl = "https://www.binary2048.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Binary 2048",
  description: "Binary 2048 web app with deterministic API",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Binary 2048",
    description: "Merge bits. Control chaos. Reach 2048.",
    url: siteUrl,
    siteName: "Binary 2048",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "Binary 2048",
    description: "Merge bits. Control chaos. Reach 2048."
  }
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const showDevNav = isDevNavEnabled();
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "Binary 2048",
        url: siteUrl
      },
      {
        "@type": "WebSite",
        name: "Binary 2048",
        url: siteUrl
      },
      {
        "@type": "SoftwareApplication",
        name: "Binary 2048",
        applicationCategory: "GameApplication",
        operatingSystem: "Web Browser",
        url: siteUrl
      }
    ]
  };
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
        <div className="top-shell">
          {showDevNav ? <DevNav /> : <div />}
          <AuthShell />
        </div>
        {children}
      </body>
    </html>
  );
}
