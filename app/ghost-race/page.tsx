import Link from "next/link";
import { buildGhostRaceChallenge } from "@/lib/binary2048/ghost-race";

type GhostRacePageProps = {
  searchParams?: Promise<{ seed?: string; maxMoves?: string }>;
};

function parsePositive(raw: string | undefined, fallback: number) {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export default async function GhostRacePage({ searchParams }: GhostRacePageProps) {
  const params = (await searchParams) ?? {};
  const seed = parsePositive(params.seed, 2048);
  const maxMoves = Math.min(1000, parsePositive(params.maxMoves, 250));
  const challenge = buildGhostRaceChallenge(seed, maxMoves);

  return (
    <main>
      <div className="card">
        <h1>Ghost Race</h1>
        <p className="brand-subtitle">Human vs rollout ghost on the same seed.</p>
        <p className="meta-text">Challenge: {challenge.challengeId}</p>
        <p className="meta-text">Seed: {challenge.seed}</p>
        <p className="meta-text">Ghost score: {challenge.ghost.score}</p>
        <p className="meta-text">Ghost turns: {challenge.ghost.turns}</p>
        <p className="meta-text">Ghost max tile: {challenge.ghost.maxTile}</p>
        <p>
          Start a matching run in the main app using this seed:
          {" "}
          <code>{challenge.seed}</code>
        </p>
        <pre>{JSON.stringify(challenge.ghost.moves, null, 2)}</pre>
        <Link className="button" href="/">
          Open Game
        </Link>
      </div>
    </main>
  );
}
