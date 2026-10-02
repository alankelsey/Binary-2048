import Link from "next/link";
import { isAdminSubject } from "@/lib/binary2048/admin-auth";
import { getRequiredServerSession } from "@/lib/binary2048/server-session";
import { getPassiveStorageStatus } from "@/lib/binary2048/ops-storage-status";
import { getFleetTelemetry } from "@/lib/binary2048/ops-telemetry";
import { getLeagueConfig } from "@/lib/binary2048/league-config";
import { listRegisteredModels } from "@/lib/binary2048/model-registry";
import { getLeaderboardPage } from "@/lib/binary2048/leaderboard";
import { opsSource } from "@/lib/binary2048/ops-shared";
import "./ops.css";

export const metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  let session;
  try { session = await getRequiredServerSession("ops-console"); }
  catch { return <main className="ops"><h1>Operations</h1><p role="alert">Authentication is temporarily unavailable.</p></main>; }
  if (!isAdminSubject(session?.user?.email || session?.user?.name)) return <main className="ops"><h1>Operations</h1><p>Operator access required.</p><Link href="/auth">Sign in</Link></main>;
  const [telemetry, league, models, leaderboard] = await Promise.allSettled([
    getFleetTelemetry(), Promise.all([getLeagueConfig("production"), getLeagueConfig("sandbox")]),
    listRegisteredModels(), getLeaderboardPage(10, 1, { namespace: "production", seasonMode: "live", includePractice: false })
  ]);
  const stores = getPassiveStorageStatus();
  return <main className="ops">
    <header><h1>Operations</h1><p>Read-only · {opsSource().scope === "shared" ? "Shared data" : "This runtime only"}</p><a href="/ops">Refresh data</a></header>
    <section aria-labelledby="ops-storage"><h2 id="ops-storage">Storage configuration</h2><p>Configuration only. Refresh does not run a write probe.</p><dl className="ops-grid">{Object.entries(stores.stores).map(([name, store]) => <div key={name}><dt>{name}</dt><dd>{store.mode} · {store.scope}</dd></div>)}</dl></section>
    <section aria-labelledby="ops-traffic"><h2 id="ops-traffic">Selected API activity</h2>
      {telemetry.status === "rejected" ? <p role="alert">Telemetry is temporarily unavailable.</p> : <>
        <p>{telemetry.value.available ? `Updated ${telemetry.value.generatedAtISO}` : "Waiting for the first aggregate."}</p>
        {(!telemetry.value.complete || telemetry.value.stale) && <p role="status">Data is incomplete or stale; these figures do not represent all current activity.</p>}
        <div className="ops-scroll" tabIndex={0} role="region" aria-label="API activity table"><table><caption>Last 24 hours for shared data; current process lifetime for runtime data</caption><thead><tr><th scope="col">Route</th><th scope="col">Calls</th><th scope="col">Errors</th><th scope="col">p95 duration</th></tr></thead><tbody>{telemetry.value.routes.map(row => <tr key={row.route}><th scope="row">{row.route}</th><td>{row.calls}</td><td>{row.errors}</td><td>{row.p95DurationMs.toFixed(0)} ms</td></tr>)}</tbody></table></div>
      </>}
    </section>
    <section aria-labelledby="ops-league"><h2 id="ops-league">League configuration</h2>{league.status === "rejected" ? <p role="alert">League configuration is unavailable.</p> : <div className="ops-grid">{league.value.map((config, i) => <div key={i}><h3>{i === 0 ? "Production" : "Sandbox"}</h3><dl><dt>Rules</dt><dd>{config.rulesetId}</dd><dt>Seed pool</dt><dd>{config.seedPoolId}</dd><dt>Move limit</dt><dd>{config.maxMoves}</dd><dt>Undo limit</dt><dd>{config.undoLimit}</dd></dl></div>)}</div>}</section>
    <section aria-labelledby="ops-models"><h2 id="ops-models">Model registry</h2>{models.status === "rejected" ? <p role="alert">Model registry is unavailable.</p> : models.value.length ? <ul>{models.value.map(model => <li key={`${model.modelId}@${model.version}`}>{model.modelId} · {model.version} · {model.active ? "Active" : "Inactive"}</li>)}</ul> : <p>No registered models.</p>}</section>
    <section aria-labelledby="ops-leaderboard"><h2 id="ops-leaderboard">Leaderboard</h2>{leaderboard.status === "rejected" ? <p role="alert">Leaderboard is unavailable.</p> : <><p>{leaderboard.value.total} ranked entries</p><Link href="/leaderboard">View leaderboard</Link></>}</section>
  </main>;
}
