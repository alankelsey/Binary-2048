export default function UserDocsPage() {
  return (
    <main>
      <div className="card">
        <h1>User Guide</h1>
        <p className="brand-subtitle">How to play Binary-2048.</p>

        <h2>Controls</h2>
        <p>Use arrow keys, WASD, or swipe on mobile.</p>

        <h2>Tile Rules</h2>
        <ul>
          <li>Equal number tiles merge upward in value.</li>
          <li>`0` acts as an annihilator.</li>
          <li>Wildcard (`✦`) boosts number outcomes by multiplier.</li>
          <li>Lock-0 (`⛓`) blocks destruction on one turn before behaving like `0`.</li>
        </ul>

        <h2>Modes</h2>
        <ul>
          <li>`Classic`: normal board start.</li>
          <li>`Bitstorm`: seeded, prefilled challenge board.</li>
        </ul>

        <h2>Replay and Sharing</h2>
        <ul>
          <li>`Export JSON` saves a run.</li>
          <li>`Replay JSON` loads and replays a run.</li>
          <li>Replay supports timeline scrubber, play/pause, and speed control.</li>
          <li>`Copy Replay Link` creates shareable replay links.</li>
        </ul>

        <h2>Accessibility</h2>
        <p>Use the in-app accessibility section for keyboard shortcut and tab-order map details.</p>

        <h2>Monetization Policy</h2>
        <p>
          Player-facing monetization commitments are published at <a href="/monetization">/monetization</a>.
        </p>

        <p>
          Full markdown copy: <a href="https://github.com/alankelsey/Binary-2048/blob/main/docs/user-guide.md">docs/user-guide.md</a>
        </p>
      </div>
    </main>
  );
}
