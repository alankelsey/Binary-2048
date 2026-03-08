import "./globals.css";
import type { ReactNode } from "react";
import { DevNav } from "@/app/dev-nav";
import { AuthShell } from "@/app/auth-shell";
import { isDevNavEnabled } from "@/lib/binary2048/dev-nav";

export const metadata = {
  title: "Binary 2048",
  description: "Binary 2048 web app with deterministic API"
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const showDevNav = isDevNavEnabled();
  return (
    <html lang="en">
      <body>
        <div className="top-shell">
          {showDevNav ? <DevNav /> : <div />}
          <AuthShell />
        </div>
        {children}
      </body>
    </html>
  );
}
