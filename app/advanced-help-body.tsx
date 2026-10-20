"use client";

export default function AdvancedHelpBody() {
  return (
    <div className="game-hint-body">
      <p>Basic moves: all tiles slide in one direction per turn.</p>
      <p>`0` tiles annihilate when they collide with any tile. `0+0` also vanishes.</p>
      <p>`Lock-0` (`⛓`) blocks one collision turn, then behaves like `0` on the next moved turn.</p>
      <p>Wildcard tiles (`✦`) double any number tile they collide with, then disappear.</p>
      <p>Game ends when no empty cells and no valid merges remain.</p>
      <p>Tip: keep your highest value anchored to one side and avoid breaking the chain.</p>
    </div>
  );
}
