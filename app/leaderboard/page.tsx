import Link from "next/link";
import { authOptions } from "@/auth";
import { buildAuthUiState } from "@/lib/binary2048/auth-ui";
import { getAuthUxMessages } from "@/lib/binary2048/auth-ux";
import { getDailyChallenge, listDailyChallengeEntries } from "@/lib/binary2048/daily-challenge";
import { getLeaderboardPage } from "@/lib/binary2048/leaderboard";
import type { LeaderboardPage } from "@/lib/binary2048/leaderboard";
import { DailyTable, RankedTable } from "@/app/leaderboard-view";
import { formatSubmittedAt } from "@/lib/binary2048/leaderboard-view";
import { getOptionalServerSession } from "@/lib/binary2048/server-session";

type LeaderboardPageProps = {
  searchParams?: Promise<{ tab?: string; limit?: string; page?: string; namespace?: string; seasonMode?: string }>;
};

function parseLimit(raw: string | undefined) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 20;
  return Math.min(100, Math.floor(parsed));
}

function parsePage(raw: string | undefined) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 1;
  return Math.floor(parsed);
}

export default async function LeaderboardPage({ searchParams }: LeaderboardPageProps) {
  const params = (await searchParams) ?? {};
  const session = await getOptionalServerSession("leaderboard-page");
  const authState = buildAuthUiState(session, authOptions.providers?.length ?? 0);
  const authUx = getAuthUxMessages(authState);
  const tab = params.tab === "daily" ? "daily" : "ranked";
  const namespace = params.namespace === "sandbox" ? "sandbox" : "production";
  const seasonMode = params.seasonMode === "preview" ? "preview" : "live";
  const limit = parseLimit(params.limit);
  const page = parsePage(params.page);
  const currentPlayerId = authState.authenticated ? authState.email ?? authState.displayName : undefined;
  let ranked: LeaderboardPage = { entries: [], limit, page, total: 0, totalPages: 1, currentPlayer: null };
  let rankedUnavailable = false;
  try {
    ranked = await getLeaderboardPage(limit, page, {
      namespace,
      includePractice: true,
      includeSandbox: namespace === "sandbox",
      seasonMode
    }, currentPlayerId);
  } catch {
    rankedUnavailable = true;
  }
  const dailyChallenge = getDailyChallenge();
  const daily = listDailyChallengeEntries(dailyChallenge.challengeId, limit);
  const isPreview = namespace === "sandbox" || seasonMode === "preview";

  return (
    <main>
      <header className="brand">
        <div>
          <h1>Leaderboard</h1>
          <p className="brand-subtitle">Ranked and Bitstorm Daily standings, {limit} entries at a time.</p>
        </div>
      </header>
      <div className="card">
        <p className="meta-text">{authUx.rankedSubmit}</p>
        <nav className="row" aria-label="Leaderboard views">
          <Link
            href={`/leaderboard?tab=ranked&limit=${limit}&page=1&namespace=production&seasonMode=live`}
            className="button"
            aria-current={tab === "ranked" && !isPreview ? "page" : undefined}
          >
            Ranked
          </Link>
          <Link
            href={`/leaderboard?tab=daily&limit=${limit}&page=1&namespace=production&seasonMode=live`}
            className="button"
            aria-current={tab === "daily" && !isPreview ? "page" : undefined}
          >
            Bitstorm Daily
          </Link>
          <Link
            href={`/leaderboard?tab=ranked&limit=${limit}&page=1&namespace=sandbox&seasonMode=preview`}
            className="button"
            aria-current={isPreview ? "page" : undefined}
          >
            Preview Season
          </Link>
          <span className="meta-text">Showing up to {limit} entries</span>
        </nav>

        {isPreview ? (
          <div className="leaderboard-preview-banner">
            Sandbox preview: these standings are isolated and don&apos;t affect the live ranked leaderboard.
          </div>
        ) : null}

        {tab === "ranked" ? (
          <section aria-label="Ranked standings">
            <h2>Ranked</h2>
            {rankedUnavailable ? (
              <p role="alert" className="leaderboard-empty">Ranked standings are temporarily unavailable.</p>
            ) : (
              <>
                {ranked.currentPlayer ? (
                  <p className="leaderboard-current-summary" aria-live="polite">
                    Your best rank: <strong>#{ranked.currentPlayer.rank}</strong>
                    {ranked.entries.some((entry) => entry.id === ranked.currentPlayer?.entry.id) ? " (highlighted below)" : " (outside this page)"}
                  </p>
                ) : currentPlayerId ? (
                  <p className="meta-text">You do not have a ranked entry in these standings yet.</p>
                ) : null}
                <RankedTable entries={ranked.entries} rankOffset={(ranked.page - 1) * ranked.limit} currentPlayerId={currentPlayerId} />
                {ranked.totalPages > 1 ? (
                  <nav className="leaderboard-pagination" aria-label="Ranked leaderboard pages">
                    {ranked.page > 1 ? <Link className="button" href={`/leaderboard?tab=ranked&limit=${limit}&page=${ranked.page - 1}&namespace=${namespace}&seasonMode=${seasonMode}`}>Previous</Link> : <span />}
                    <span className="meta-text">Page {ranked.page} of {ranked.totalPages} · {ranked.total} entries</span>
                    {ranked.page < ranked.totalPages ? <Link className="button" href={`/leaderboard?tab=ranked&limit=${limit}&page=${ranked.page + 1}&namespace=${namespace}&seasonMode=${seasonMode}`}>Next</Link> : <span />}
                  </nav>
                ) : null}
              </>
            )}
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
