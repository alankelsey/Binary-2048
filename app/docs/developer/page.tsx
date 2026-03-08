export default function DeveloperDocsPage() {
  return (
    <main>
      <div className="card">
        <h1>Developer Guide</h1>
        <p className="brand-subtitle">API and integration notes for Binary-2048.</p>

        <h2>Local Endpoints</h2>
        <ul>
          <li>App: <a href="/">/</a></li>
          <li>OpenAPI JSON: <a href="/api/openapi">/api/openapi</a></li>
          <li>API Docs UI: <a href="/api-docs">/api-docs</a></li>
        </ul>

        <h2>Replay Contract</h2>
        <ul>
          <li>Replay header is schema-locked (`replayVersion`, `rulesetId`, `engineVersion`, `size`, `seed`, `createdAt`).</li>
          <li>Compatibility checks enforce size/seed alignment with config and initial grid shape.</li>
          <li>Export replay metadata includes normalized step logs (`rngStepStart`, `rngStepEnd`, `scoreDelta`, `scoreTotal`, normalized events).</li>
        </ul>

        <h2>Common APIs</h2>
        <ul>
          <li>Game lifecycle: `/api/games`, `/api/games/:id`, `/api/games/:id/move`, `/api/games/:id/undo`</li>
          <li>Replay: `/api/games/:id/export`, `/api/games/:id/replay`, `/api/replay`, `/api/replay/postmortem`, `/api/replay/code`</li>
          <li>Daily challenge: `/api/challenges/daily`, `/api/challenges/daily/submit`</li>
          <li>Ghost race: `/api/challenges/ghost-race`, `/api/challenges/ghost-race/submit`</li>
          <li>Runs: `/api/runs/:id`, `/api/runs/:id/replay`</li>
          <li>AI: `/api/games/:id/encoded`, `/api/simulate`, `/api/bots/tournament`</li>
          <li>Ranked/security: `/api/leaderboard/submit`, `/api/auth/entitlements/proof`</li>
        </ul>

        <h2>Testing</h2>
        <ul>
          <li>`npm run test:unit`</li>
          <li>`npm run test:all`</li>
          <li>`npm run roadmap:status`</li>
        </ul>

        <p>
          Full markdown copy: <a href="https://github.com/alankelsey/Binary-2048/blob/main/docs/developer-guide.md">docs/developer-guide.md</a>
        </p>
      </div>
    </main>
  );
}
