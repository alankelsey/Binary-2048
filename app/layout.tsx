import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Binary 2048",
  description: "Binary 2048 web app with deterministic API"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
