import type { Metadata } from "next";
import { ScenarioBuilder } from "@/app/scenario-builder/scenario-builder";

export const metadata: Metadata = {
  title: "Scenario Builder | Binary 2048",
  description: "Construct deterministic Binary 2048 practice scenarios."
};

export default function ScenarioBuilderPage() {
  return <ScenarioBuilder />;
}
