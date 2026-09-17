import { renderToStaticMarkup } from "react-dom/server";
import { DailyTable, RankedTable } from "@/app/leaderboard-view";
import type { DailyChallengeEntry } from "@/lib/binary2048/daily-challenge";
import type { LeaderboardEntry } from "@/lib/binary2048/leaderboard";

// Static-render coverage for the real leaderboard JSX components, using
// react-dom/server's renderToStaticMarkup against a tsconfig.jest.json-only
// `jsx: "react-jsx"` compile (see jest.config.cjs). This is what
// tests/ui/leaderboard.browser.spec.ts's "populated" tests explicitly are
// NOT: those inject markup mirroring this contract into a real page for
// layout/CSS coverage, but never import or execute RankedTable/DailyTable
// themselves. This file renders the actual components and asserts on their
// real output — captions, headers, rows, tier labels, formatted values,
// empty states, and player ids.

function rankedEntry(overrides: Partial<LeaderboardEntry> = {}): LeaderboardEntry {
  return {
    id: "entry_1",
    namespace: "production",
    isSandbox: false,
    isPractice: false,
    seasonMode: "live",
    playerId: "player_alpha",
    userTier: "authed",
    gameId: "game_1",
    score: 2048,
    moves: 120,
    maxTile: 1024,
    stateHash: "hash_1",
    rulesetId: "binary2048-v1",
    submittedAtISO: "2026-09-15T18:04:31.000Z",
    ...overrides
  };
}

function dailyEntry(overrides: Partial<DailyChallengeEntry> = {}): DailyChallengeEntry {
  return {
    id: "daily_1",
    challengeId: "challenge_1",
    playerId: "player_alpha",
    score: 2048,
    moves: 120,
    maxTile: 1024,
    submittedAtISO: "2026-09-15T18:04:31.000Z",
    ...overrides
  };
}

describe("RankedTable", () => {
  it("renders an empty state with no table when there are no entries", () => {
    const html = renderToStaticMarkup(<RankedTable entries={[]} />);
    expect(html).toContain("No ranked runs yet.");
    expect(html).toContain("Play a game and submit your score to claim the top spot.");
    expect(html).not.toContain("<table");
  });

  it("renders a caption, headers, and formatted rows for real entries", () => {
    const entries: LeaderboardEntry[] = [
      rankedEntry({ id: "e1", playerId: "player_alpha", userTier: "authed", score: 2048, maxTile: 1024, moves: 120 }),
      rankedEntry({ id: "e2", playerId: "player_beta", userTier: "paid", score: 1024, maxTile: 512, moves: 98 }),
      rankedEntry({
        id: "e3",
        playerId: "player_gamma_extra_long_id",
        userTier: "guest",
        score: 512,
        maxTile: 256,
        moves: 64
      })
    ];
    const html = renderToStaticMarkup(<RankedTable entries={entries} />);

    expect(html).toContain('<caption class="sr-only">Ranked leaderboard standings</caption>');
    for (const header of ["Rank", "Player", "Score", "Max tile", "Moves", "Submitted"]) {
      expect(html).toContain(`>${header}<`);
    }

    // Rank classing and ordinal labels come from index position, not entry data.
    expect(html).toContain('class="leaderboard-rank top-1"');
    expect(html).toContain('class="leaderboard-rank top-2"');
    expect(html).toContain('class="leaderboard-rank top-3"');
    expect(html).toContain(">#1<");
    expect(html).toContain(">#2<");
    expect(html).toContain(">#3<");

    // Tier labels.
    expect(html).toContain('auth-tier-authed');
    expect(html).toContain(">Player<");
    expect(html).toContain('auth-tier-paid');
    expect(html).toContain(">Pro<");
    expect(html).toContain('auth-tier-guest');
    expect(html).toContain(">Guest<");

    // Formatted numeric values (toLocaleString) and dates (formatSubmittedAt).
    expect(html).toContain("2,048");
    expect(html).toContain("2026-09-15 18:04 UTC");

    // Short ids pass through; long ids are truncated head/tail.
    expect(html).toContain(">player_alpha<");
    expect(html).toContain("player…g_id");
  });
});

describe("DailyTable", () => {
  it("renders an empty state with no table when there are no entries", () => {
    const html = renderToStaticMarkup(<DailyTable entries={[]} />);
    expect(html).toContain("No submissions for today");
    expect(html).toContain("Bitstorm Daily yet.");
    expect(html).not.toContain("<table");
  });

  it("renders a caption, headers, and a bare player id column for real entries", () => {
    const entries: DailyChallengeEntry[] = [
      dailyEntry({ id: "d1", playerId: "guest_42", score: 2048, maxTile: 1024, moves: 120 })
    ];
    const html = renderToStaticMarkup(<DailyTable entries={entries} />);

    expect(html).toContain('<caption class="sr-only">Bitstorm Daily standings</caption>');
    for (const header of ["Rank", "Player", "Score", "Max tile", "Moves", "Submitted"]) {
      expect(html).toContain(`>${header}<`);
    }
    expect(html).toContain('class="leaderboard-player-id">guest_42<');
    expect(html).toContain("2,048");
    expect(html).toContain("2026-09-15 18:04 UTC");
  });
});
