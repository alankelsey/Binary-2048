import React from "react";

type GameOverOverlayProps = {
  visible: boolean;
  score: number;
  highScore: number;
  onNewGame: () => void;
  onTutorial: () => void;
  onOptions: () => void;
};

type WinOverlayProps = {
  visible: boolean;
  score: number;
  highScore: number;
  sessionClass: "ranked" | "unranked";
  canContinue: boolean;
  onContinue: () => void;
  onNewGame: () => void;
  onTutorial: () => void;
  onOptions: () => void;
};

type NewGameOverlayProps = {
  visible: boolean;
  starting: boolean;
  onStart: () => void;
  onTutorial: () => void;
  onOptions: () => void;
};

export function NewGameOverlay({
  visible,
  starting,
  onStart,
  onTutorial,
  onOptions
}: NewGameOverlayProps) {
  if (!visible) return null;
  return (
    <div className="newgame-overlay" role="dialog" aria-modal="true" aria-labelledby="newgame-overlay-title">
      <div className="newgame-title" id="newgame-overlay-title">NEW GAME</div>
      <p className="newgame-copy">Start a fresh Binary 2048 board, learn the rules, or adjust options.</p>
      <div className="newgame-actions">
        <button type="button" className="primary-action" disabled={starting} onClick={onStart} autoFocus>
          {starting ? "Starting…" : "Start New Game"}
        </button>
        <button type="button" onClick={onTutorial}>Play tutorial</button>
        <button type="button" onClick={onOptions}>Options</button>
      </div>
    </div>
  );
}

export function GameOverOverlay({ visible, score, highScore, onNewGame, onTutorial, onOptions }: GameOverOverlayProps) {
  if (!visible) return null;
  return (
    <div className="gameover-overlay" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
      <div className="gameover-title" id="gameover-title">GAME OVER</div>
      <div className="gameover-stats"><span>Score: {score}</span><span>High: {highScore}</span></div>
      <div className="gameover-actions">
        <button type="button" className="primary-action" onClick={onNewGame}>New Game</button>
        <button type="button" onClick={onTutorial}>Tutorial</button>
        <button type="button" onClick={onOptions}>Options</button>
      </div>
    </div>
  );
}

export function WinOverlay({
  visible,
  score,
  highScore,
  sessionClass,
  canContinue,
  onContinue,
  onNewGame,
  onTutorial,
  onOptions
}: WinOverlayProps) {
  if (!visible) return null;
  return (
    <div className="win-overlay" role="dialog" aria-modal="true" aria-labelledby="win-title">
      <div className="win-burst" aria-hidden="true" />
      <div className="win-title" id="win-title">YOU WIN</div>
      <div className="win-stats">
        <span>Score: {score}</span>
        <span>High: {highScore}</span>
        <span>Session: {sessionClass}</span>
      </div>
      <div className="win-actions">
        {canContinue ? (
          <button type="button" onClick={onContinue}>Continue</button>
        ) : (
          <button type="button" disabled title="Continue disabled for ranked/vs sessions">Continue Disabled</button>
        )}
        <button type="button" className="primary-action" onClick={onNewGame}>New Game</button>
        <button type="button" onClick={onTutorial}>Tutorial</button>
        <button type="button" onClick={onOptions}>Options</button>
      </div>
    </div>
  );
}
