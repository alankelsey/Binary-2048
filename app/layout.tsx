import "./globals.css";
import type { ReactNode } from "react";
import { DevNav } from "@/app/dev-nav";
import { isDevNavEnabled } from "@/lib/binary2048/dev-nav";

export const metadata = {
  title: "Binary 2048",
  description: "Binary 2048 web app with deterministic API"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const showDevNav = isDevNavEnabled();
  return (
    <html lang="en">
      <body>
        {showDevNav ? <DevNav /> : null}
        {children}
      </body>
    </html>
  );
}
