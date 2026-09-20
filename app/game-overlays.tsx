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
  onTutorial: () => void;
  onOptions: () => void;
  tutorialReminder: boolean;
  suppressTutorialReminder: boolean;
  onSuppressTutorialReminderChange: (checked: boolean) => void;
};

export function NewGameOverlay({
  visible,
  starting,
  onStart,
  onTutorial,
  onOptions,
  tutorialReminder,
  suppressTutorialReminder,
  onSuppressTutorialReminderChange
}: NewGameOverlayProps) {
  if (!visible) return null;
  return (
    <div className="newgame-overlay" role="dialog" aria-modal="true" aria-labelledby="newgame-overlay-title">
      <div className="newgame-title" id="newgame-overlay-title">NEW GAME</div>
      <p className="newgame-copy">
        {tutorialReminder ? "New here? Learn every move and special tile first." : "Start a fresh Binary 2048 board."}
      </p>
      <div className="newgame-actions">
        <button type="button" className="primary-action" disabled={starting} onClick={onStart} autoFocus>
          {starting ? "Starting…" : "Start New Game"}
        </button>
        <button type="button" onClick={onTutorial}>Play tutorial</button>
        <button type="button" onClick={onOptions}>Options</button>
      </div>
      {tutorialReminder ? (
        <label className="tutorial-suppress-choice">
          <input
            type="checkbox"
            checked={suppressTutorialReminder}
            onChange={(event) => onSuppressTutorialReminderChange(event.target.checked)}
          />
          <span>Don&apos;t show this again</span>
        </label>
      ) : null}
    </div>
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
