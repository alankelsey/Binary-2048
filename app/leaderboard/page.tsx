import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { buildAuthUiState } from "@/lib/binary2048/auth-ui";
import { getAuthUxMessages } from "@/lib/binary2048/auth-ux";
import { getDailyChallenge, listDailyChallengeEntries } from "@/lib/binary2048/daily-challenge";
import { listLeaderboardEntries } from "@/lib/binary2048/leaderboard";

type LeaderboardPageProps = {
  searchParams?: Promise<{ tab?: string; limit?: string; namespace?: string; seasonMode?: string }>;
};

function parseLimit(raw: string | undefined) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(100, Math.floor(parsed));
}

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const params = (await searchParams) ?? {};
  const session = await getServerSession(authOptions);
  const authState = buildAuthUiState(session, authOptions.providers?.length ?? 0);
  const authUx = getAuthUxMessages(authState);
  const tab = params.tab === "daily" ? "daily" : "ranked";
  const namespace = params.namespace === "sandbox" ? "sandbox" : "production";
  const seasonMode = params.seasonMode === "preview" ? "preview" : "live";
  const limit = parseLimit(params.limit);
  const ranked = listLeaderboardEntries(limit, {
    namespace,
    includePractice: true,
    includeSandbox: namespace === "sandbox",
    seasonMode
  });
  const dailyChallenge = getDailyChallenge();
  const daily = listDailyChallengeEntries(dailyChallenge.challengeId, limit);

  return (
    <main>
      <div className="card">
        <h1>Leaderboard</h1>
        <p className="brand-subtitle">Ranked and Bitstorm Daily views with simple filters.</p>
        <p className="meta-text">{authUx.rankedSubmit}</p>
        <div className="row">
          <Link href={`/leaderboard?tab=ranked&limit=${limit}&namespace=production&seasonMode=live`} className="button">
            Ranked
          </Link>
          <Link href={`/leaderboard?tab=daily&limit=${limit}&namespace=production&seasonMode=live`} className="button">
            Daily
          </Link>
          <Link href={`/leaderboard?tab=ranked&limit=${limit}&namespace=sandbox&seasonMode=preview`} className="button">
            Preview Season
          </Link>
          <span className="meta-text">Limit: {limit}</span>
        </div>
        {(namespace === "sandbox" || seasonMode === "preview") && (
          <div
            style={{
              marginTop: "0.75rem",
              marginBottom: "0.75rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.5rem",
              border: "1px dashed #f7c873",
              background: "rgba(247, 200, 115, 0.12)",
              color: "#f7c873",
              fontWeight: 700,
              letterSpacing: "0.02em"
            }}
          >
            SANDBOX PREVIEW: standings are isolated and do not affect live ranked leaderboards.
          </div>
        )}

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
