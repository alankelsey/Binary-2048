import { buildIssueReportUrl } from "@/lib/binary2048/issue-report";

describe("buildIssueReportUrl", () => {
  it("builds a github issue link with context", () => {
    const url = buildIssueReportUrl({
      origin: "https://www.binary2048.com",
      pathname: "/leaderboard",
      version: "0.1.0",
      commit: "abc123",
      gameId: "g_7",
      spawnMode: "normal",
      gameMode: "classic",
      replay: false
    });

    const parsed = new URL(url);
    const body = parsed.searchParams.get("body") ?? "";
    const labels = parsed.searchParams.get("labels") ?? "";

    expect(url).toContain("https://github.com/alankelsey/Binary-2048/issues/new");
    expect(url).toContain("template=bug_report.yml");
    expect(labels).toBe("bug,player-feedback");
    expect(body).toContain("Game ID: g_7");
    expect(body).toContain("Page: https://www.binary2048.com/leaderboard");
  });
});
