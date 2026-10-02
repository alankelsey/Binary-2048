import { CloudWatchLogsClient, FilterLogEventsCommand } from "@aws-sdk/client-cloudwatch-logs";
import { writeOpsValue } from "@/lib/binary2048/ops-shared";

export type FleetTelemetry = {
  generatedAtISO: string; startedAtISO: string; throughISO: string; complete: boolean;
  routes: Array<{ route: string; calls: number; errors: number; avgDurationMs: number; p95DurationMs: number; maxDurationMs: number; errorRatePct: number; totalCostUnits: number }>;
};

export async function handler() {
  const group = process.env.BINARY2048_TELEMETRY_LOG_GROUP;
  if (!group) throw new Error("Telemetry log group not configured");
  const end = Date.now() - 120000;
  const start = end - 86400000;
  const client = new CloudWatchLogsClient({ region: process.env.BINARY2048_WORKER_REGION ?? "us-east-2" });
  const seen = new Set<string>();
  const routes = new Map<string, { durations: number[]; errors: number; cost: number }>();
  let nextToken: string | undefined;
  let complete = false;
  for (let page = 0; page < 20; page++) {
    const result = await client.send(new FilterLogEventsCommand({ logGroupName: group, startTime: start, endTime: end, filterPattern: '"binary2048_route_metric"', limit: 500, nextToken }));
    for (const event of result.events ?? []) {
      if (!event.eventId || seen.has(event.eventId)) continue;
      seen.add(event.eventId);
      const raw = event.message ?? "";
      let metric;
      try { metric = JSON.parse(raw.slice(raw.indexOf('{'))) as { event?: string; route?: string; status?: number; durationMs?: number; costUnits?: number }; } catch { continue; }
      if (metric.event !== "binary2048_route_metric" || !metric.route?.startsWith("/api/") || typeof metric.durationMs !== "number" || !Number.isFinite(metric.durationMs)) continue;
      const row = routes.get(metric.route) ?? { durations: [], errors: 0, cost: 0 };
      row.durations.push(Math.max(0, metric.durationMs));
      if ((metric.status ?? 0) >= 400) row.errors++;
      row.cost += metric.costUnits ?? 0;
      routes.set(metric.route, row);
    }
    nextToken = result.nextToken;
    if (!nextToken) { complete = true; break; }
  }
  const snapshot: FleetTelemetry = {
    generatedAtISO: new Date().toISOString(), startedAtISO: new Date(start).toISOString(), throughISO: new Date(end).toISOString(), complete,
    routes: [...routes].map(([route, row]) => {
      row.durations.sort((a,b) => a-b);
      const calls = row.durations.length;
      return { route, calls, errors: row.errors, errorRatePct: row.errors / calls * 100,
        avgDurationMs: row.durations.reduce((a,b)=>a+b,0) / calls,
        p95DurationMs: row.durations[Math.max(0, Math.ceil(calls * .95)-1)], maxDurationMs: row.durations[calls-1], totalCostUnits: row.cost };
    }).sort((a,b)=>a.route.localeCompare(b.route))
  };
  await writeOpsValue("telemetry", snapshot);
  return { complete, events: seen.size, routes: snapshot.routes.length };
}
