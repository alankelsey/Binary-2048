import type { DailyChallengeEntry } from "@/lib/binary2048/daily-challenge";
import type { LeaderboardEntry } from "@/lib/binary2048/leaderboard";
import { formatSubmittedAt, rankClass, shortPlayerId, TIER_LABEL } from "@/lib/binary2048/leaderboard-view";

// Pure presentational components for the leaderboard page, split out from
// app/leaderboard/page.tsx (a Server Component that pulls in next-auth /
// session lookups) so they can be exercised directly — by static rendering
// + a real browser for the table markup itself — without needing a live
// server, auth, or the in-memory leaderboard store to be populated through
// the real submit flow. Formatting helpers live in
// lib/binary2048/leaderboard-view.ts (plain .ts, unit-testable under this
// repo's Jest setup, which can't parse JSX).

export function RankedTable({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="leaderboard-empty">
        <p>No ranked runs yet.</p>
        <p>Play a game and submit your score to claim the top spot.</p>
      </div>
    );
  }
  return (
    <div className="leaderboard-table-wrap">
      <table className="leaderboard-table">
        <caption className="sr-only">Ranked leaderboard standings</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Player</th>
            <th scope="col" className="num">
              Score
            </th>
            <th scope="col" className="num">
              Max tile
            </th>
            <th scope="col" className="num">
              Moves
            </th>
            <th scope="col">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const rank = index + 1;
            return (
              <tr key={entry.id}>
                <td className={rankClass(rank)}>#{rank}</td>
                <td>
                  <span className="leaderboard-player">
                    <span className={`auth-tier auth-tier-${entry.userTier === "paid" ? "paid" : entry.userTier === "authed" ? "authed" : "guest"}`}>
                      {TIER_LABEL[entry.userTier]}
                    </span>
                    <span className="leaderboard-player-id">{shortPlayerId(entry.playerId)}</span>
                  </span>
                </td>
                <td className="num leaderboard-score">{entry.score.toLocaleString("en-US")}</td>
                <td className="num">{entry.maxTile.toLocaleString("en-US")}</td>
                <td className="num">{entry.moves.toLocaleString("en-US")}</td>
                <td className="meta-text">{formatSubmittedAt(entry.submittedAtISO)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function DailyTable({ entries }: { entries: DailyChallengeEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="leaderboard-empty">
        <p>No submissions for today&apos;s Bitstorm Daily yet.</p>
        <p>Everyone plays the same seed — set today&apos;s pace.</p>
      </div>
    );
  }
  return (
    <div className="leaderboard-table-wrap">
      <table className="leaderboard-table">
        <caption className="sr-only">Bitstorm Daily standings</caption>
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Player</th>
            <th scope="col" className="num">
              Score
            </th>
            <th scope="col" className="num">
              Max tile
            </th>
            <th scope="col" className="num">
              Moves
            </th>
            <th scope="col">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const rank = index + 1;
            return (
              <tr key={entry.id}>
                <td className={rankClass(rank)}>#{rank}</td>
                <td className="leaderboard-player-id">{shortPlayerId(entry.playerId)}</td>
                <td className="num leaderboard-score">{entry.score.toLocaleString("en-US")}</td>
                <td className="num">{entry.maxTile.toLocaleString("en-US")}</td>
                <td className="num">{entry.moves.toLocaleString("en-US")}</td>
                <td className="meta-text">{formatSubmittedAt(entry.submittedAtISO)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
