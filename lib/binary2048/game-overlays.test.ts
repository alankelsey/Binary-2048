import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { GameOverOverlay, WinOverlay } from "@/app/game-overlays";

describe("game overlays", () => {
  it("renders game over overlay with score and high score", () => {
    const html = renderToStaticMarkup(
      React.createElement(GameOverOverlay, { visible: true, score: 321, highScore: 999 })
    );
    expect(html).toContain("GAME OVER");
    expect(html).toContain("Score: 321");
    expect(html).toContain("High: 999");
  });

  it("renders win overlay with continue/new game actions in free play", () => {
    const html = renderToStaticMarkup(
      React.createElement(WinOverlay, {
        visible: true,
        score: 2048,
        highScore: 4096,
        sessionClass: "unranked",
        canContinue: true,
        onContinue: () => {},
        onNewGame: () => {}
      })
    );
    expect(html).toContain("YOU WIN");
    expect(html).toContain("Session: unranked");
    expect(html).toContain(">Continue<");
    expect(html).toContain(">New Game<");
  });

  it("renders disabled continue state for ranked sessions", () => {
    const html = renderToStaticMarkup(
      React.createElement(WinOverlay, {
        visible: true,
        score: 2048,
        highScore: 4096,
        sessionClass: "ranked",
        canContinue: false,
        onContinue: () => {},
        onNewGame: () => {}
      })
    );
    expect(html).toContain("YOU WIN");
    expect(html).toContain("Session: ranked");
    expect(html).toContain("Continue Disabled");
    expect(html).toContain("disabled");
  });
});
