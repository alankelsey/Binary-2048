import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { buildAuthUiState } from "@/lib/binary2048/auth-ui";
import { getAuthUxMessages } from "@/lib/binary2048/auth-ux";
import { getDailyChallenge, listDailyChallengeEntries } from "@/lib/binary2048/daily-challenge";
import { listLeaderboardEntries } from "@/lib/binary2048/leaderboard";
import { DailyTable, RankedTable } from "@/app/leaderboard-view";
import { formatSubmittedAt } from "@/lib/binary2048/leaderboard-view";

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
  let session = null;
  try {
    session = await getServerSession(authOptions);
  } catch {
    session = null;
  }
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
  const isPreview = namespace === "sandbox" || seasonMode === "preview";

  return (
    <main>
      <header className="brand">
        <div>
          <h1>Leaderboard</h1>
          <p className="brand-subtitle">Ranked and Bitstorm Daily standings, top {limit} of each.</p>
        </div>
      </header>
      <div className="card">
        <p className="meta-text">{authUx.rankedSubmit}</p>
        <nav className="row" aria-label="Leaderboard views">
          <Link
            href={`/leaderboard?tab=ranked&limit=${limit}&namespace=production&seasonMode=live`}
            className="button"
            aria-current={tab === "ranked" && !isPreview ? "page" : undefined}
          >
            Ranked
          </Link>
          <Link
            href={`/leaderboard?tab=daily&limit=${limit}&namespace=production&seasonMode=live`}
            className="button"
            aria-current={tab === "daily" && !isPreview ? "page" : undefined}
          >
            Bitstorm Daily
          </Link>
          <Link
            href={`/leaderboard?tab=ranked&limit=${limit}&namespace=sandbox&seasonMode=preview`}
            className="button"
            aria-current={isPreview ? "page" : undefined}
          >
            Preview Season
          </Link>
          <span className="meta-text">Showing top {limit}</span>
        </nav>

        {isPreview ? (
          <div className="leaderboard-preview-banner">
            Sandbox preview: these standings are isolated and don&apos;t affect the live ranked leaderboard.
          </div>
        ) : null}

        {tab === "ranked" ? (
          <section aria-label="Ranked standings">
            <h2>Ranked</h2>
            <RankedTable entries={ranked} />
          </section>
        ) : (
          <section aria-label="Bitstorm Daily standings">
            <h2>Bitstorm Daily — {dailyChallenge.dateISO}</h2>
            <p className="meta-text">
              Window: {formatSubmittedAt(dailyChallenge.windowStartISO)} to {formatSubmittedAt(dailyChallenge.windowEndISO)}
            </p>
            <DailyTable entries={daily} />
          </section>
        )}
      </div>
    </main>
  );
}
