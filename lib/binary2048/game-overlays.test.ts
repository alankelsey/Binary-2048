import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { GameOverOverlay, NewGameOverlay, WinOverlay } from "@/app/game-overlays";

describe("game overlays", () => {
  const newGameProps = {
    visible: true,
    starting: false,
    onStart: () => {},
    onTutorial: () => {},
    children: React.createElement("div", { "aria-label": "New game choices" }, "Difficulty Mode Theme")
  };

  it("renders a direct new-game action for an empty board", () => {
    const html = renderToStaticMarkup(
      React.createElement(NewGameOverlay, newGameProps)
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain("NEW GAME");
    expect(html).toContain(">Start New Game<");
    expect(html).toContain(">Play tutorial<");
    expect(html).toContain("New game choices");
    expect(html).toContain("adjust options");
  });

  it("disables the new-game overlay action while starting", () => {
    const html = renderToStaticMarkup(
      React.createElement(NewGameOverlay, { ...newGameProps, starting: true })
    );
    expect(html).toContain("disabled");
    expect(html).toContain("Starting…");
  });

  it("renders game over overlay with score and high score", () => {
    const html = renderToStaticMarkup(
      React.createElement(GameOverOverlay, {
        visible: true,
        score: 321,
        highScore: 999,
        onNewGame: () => {},
        onTutorial: () => {},
        onReplay: () => {}
      })
    );
    expect(html).toContain("GAME OVER");
    expect(html).toContain("Score: 321");
    expect(html).toContain("High: 999");
    expect(html).toContain(">New Game<");
    expect(html).toContain(">Tutorial<");
    expect(html).toContain(">Replay JSON<");
    expect(html).not.toContain(">Options<");
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
        onNewGame: () => {},
        onTutorial: () => {},
        onReplay: () => {}
      })
    );
    expect(html).toContain("YOU WIN");
    expect(html).toContain("Session: unranked");
    expect(html).toContain(">Continue<");
    expect(html).toContain(">New Game<");
    expect(html).toContain(">Tutorial<");
    expect(html).toContain(">Replay JSON<");
    expect(html).not.toContain(">Options<");
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
        onNewGame: () => {},
        onTutorial: () => {},
        onReplay: () => {}
      })
    );
    expect(html).toContain("YOU WIN");
    expect(html).toContain("Session: ranked");
    expect(html).toContain("Continue Disabled");
    expect(html).toContain("disabled");
  });
});
