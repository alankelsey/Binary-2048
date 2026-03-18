type BuildIssueReportUrlInput = {
  origin: string;
  pathname: string;
  version: string;
  commit: string;
  gameId?: string;
  spawnMode?: string;
  gameMode?: string;
  replay?: boolean;
  title?: string;
};

const ISSUE_BASE = "https://github.com/alankelsey/Binary-2048/issues/new";

export function buildIssueReportUrl(input: BuildIssueReportUrlInput): string {
  const url = new URL(ISSUE_BASE);
  url.searchParams.set("template", "bug_report.yml");
  url.searchParams.set("labels", "bug,player-feedback");
  url.searchParams.set("title", input.title ?? "bug: short summary");

  const body = [
    "## Context",
    `- Page: ${input.origin}${input.pathname}`,
    `- Version: ${input.version}`,
    `- Commit: ${input.commit}`,
    `- Game ID: ${input.gameId ?? "n/a"}`,
    `- Difficulty: ${input.spawnMode ?? "n/a"}`,
    `- Mode: ${input.gameMode ?? "n/a"}`,
    `- Replay active: ${input.replay ? "yes" : "no"}`,
    "",
    "## What happened",
    "- Describe the bug here.",
    "",
    "## Expected behavior",
    "- Describe what you expected instead."
  ].join("\n");

  url.searchParams.set("body", body);
  return url.toString();
}
