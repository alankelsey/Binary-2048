export default function MonetizationPage() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "2rem 1rem" }}>
      <h1>Monetization Policy</h1>
      <p>Binary-2048 keeps ranked play fair and transparent.</p>

      <h2>Paid Features</h2>
      <ul>
        <li>Cosmetic themes and visual packs.</li>
        <li>Optional subscriptions for ad-free and feature access.</li>
        <li>Non-ranked convenience mechanics where explicitly allowed.</li>
      </ul>

      <h2>Never Pay-to-Win</h2>
      <ul>
        <li>Ranked leaderboard outcomes cannot be purchased.</li>
        <li>`ranked_pure` integrity is server-enforced.</li>
        <li>Ad-assisted or undo-assisted runs are not `ranked_pure` eligible.</li>
      </ul>

      <h2>Ads</h2>
      <ul>
        <li>Rewarded and opt-in only.</li>
        <li>No forced gameplay-interrupt ads.</li>
        <li>Paid tier remains ad-free.</li>
      </ul>

      <p>
        Full markdown copy:{" "}
        <a href="https://github.com/alankelsey/Binary-2048/blob/main/docs/player-monetization-policy.md">
          docs/player-monetization-policy.md
        </a>
      </p>
    </main>
  );
}
