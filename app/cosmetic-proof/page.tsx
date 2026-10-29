import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CosmeticAssetProof } from "@/app/cosmetic-asset-proof";

export const metadata: Metadata = {
  title: "Cosmetic asset proof | Binary 2048",
  robots: { index: false, follow: false }
};

export default function CosmeticProofPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main>
      <CosmeticAssetProof />
    </main>
  );
}
