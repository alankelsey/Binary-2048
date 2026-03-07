import Link from "next/link";
import { getDailyChallenge, listDailyChallengeEntries } from "@/lib/binary2048/daily-challenge";
import { listLeaderboardEntries } from "@/lib/binary2048/leaderboard";

type LeaderboardPageProps = {
  searchParams?: Promise<{ tab?: string; limit?: string }>;
};

function parseLimit(raw: string | undefined) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(100, Math.floor(parsed));
}

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const params = (await searchParams) ?? {};
  const tab = params.tab === "daily" ? "daily" : "ranked";
  const limit = parseLimit(params.limit);
  const ranked = listLeaderboardEntries(limit);
  const dailyChallenge = getDailyChallenge();
  const daily = listDailyChallengeEntries(dailyChallenge.challengeId, limit);

  return (
    <main>
      <div className="card">
        <h1>Leaderboard</h1>
        <p className="brand-subtitle">Ranked and Bitstorm Daily views with simple filters.</p>
        <div className="row">
          <Link href={`/leaderboard?tab=ranked&limit=${limit}`} className="button">
            Ranked
          </Link>
          <Link href={`/leaderboard?tab=daily&limit=${limit}`} className="button">
            Daily
          </Link>
          <span className="meta-text">Limit: {limit}</span>
        </div>

        {tab === "ranked" ? (
          <>
            <h2>Ranked</h2>
            <pre>{JSON.stringify(ranked, null, 2)}</pre>
          </>
        ) : (
          <>
            <h2>Bitstorm Daily ({dailyChallenge.dateISO})</h2>
            <p className="meta-text">Window: {dailyChallenge.windowStartISO} to {dailyChallenge.windowEndISO}</p>
            <pre>{JSON.stringify(daily, null, 2)}</pre>
          </>
        )}
      </div>
    </main>
  );
}
