import React from "react";

type GameOverOverlayProps = {
  visible: boolean;
  score: number;
  highScore: number;
};

type WinOverlayProps = {
  visible: boolean;
  score: number;
  highScore: number;
  sessionClass: "ranked" | "unranked";
  canContinue: boolean;
  onContinue: () => void;
  onNewGame: () => void;
};

type NewGameOverlayProps = {
  visible: boolean;
  starting: boolean;
  onStart: () => void;
};

export function NewGameOverlay({ visible, starting, onStart }: NewGameOverlayProps) {
  if (!visible) return null;
  return React.createElement(
    "div",
    { className: "newgame-overlay", role: "dialog", "aria-labelledby": "newgame-overlay-title" },
    React.createElement("div", { className: "newgame-title", id: "newgame-overlay-title" }, "NEW GAME"),
    React.createElement("p", { className: "newgame-copy" }, "Start a fresh Binary 2048 board."),
    React.createElement(
      "button",
      { type: "button", disabled: starting, onClick: onStart },
      starting ? "Starting…" : "Start New Game"
    )
  );
}

export function GameOverOverlay({ visible, score, highScore }: GameOverOverlayProps) {
  if (!visible) return null;
  return React.createElement(
    "div",
    { className: "gameover-overlay", role: "status", "aria-live": "polite" },
    React.createElement("div", { className: "gameover-title" }, "GAME OVER"),
    React.createElement(
      "div",
      { className: "gameover-stats" },
      React.createElement("span", null, `Score: ${score}`),
      React.createElement("span", null, `High: ${highScore}`)
    )
  );
}

export function WinOverlay({
  visible,
  score,
  highScore,
  sessionClass,
  canContinue,
  onContinue,
  onNewGame
}: WinOverlayProps) {
  if (!visible) return null;
  const continueButton = canContinue
    ? React.createElement("button", { onClick: onContinue }, "Continue")
    : React.createElement(
        "button",
        { disabled: true, title: "Continue disabled for ranked/vs sessions" },
        "Continue Disabled"
      );
  return React.createElement(
    "div",
    { className: "win-overlay", role: "status", "aria-live": "polite" },
    React.createElement("div", { className: "win-burst", "aria-hidden": "true" }),
    React.createElement("div", { className: "win-title" }, "YOU WIN"),
    React.createElement(
      "div",
      { className: "win-stats" },
      React.createElement("span", null, `Score: ${score}`),
      React.createElement("span", null, `High: ${highScore}`),
      React.createElement("span", null, `Session: ${sessionClass}`)
    ),
    React.createElement(
      "div",
      { className: "win-actions" },
      continueButton,
      React.createElement("button", { onClick: onNewGame }, "New Game")
    )
  );
}
