"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  commitScenarioGrid,
  createEmptyScenarioGrid,
  createScenarioGridHistory,
  createScenarioBuilderState,
  placeScenarioTile,
  redoScenarioGrid,
  resizeScenarioGrid,
  scenarioSymmetryCoordinates,
  scenarioTileLabel,
  undoScenarioGrid,
  validateScenario,
  type ScenarioGameMode,
  type ScenarioSymmetry
} from "@/lib/binary2048/scenario-builder";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

const MIN_BOARD_SIZE = 2;
const MAX_BOARD_SIZE = 8;
const SYMMETRY_OPTIONS: Array<{ value: ScenarioSymmetry; label: string; accessibleLabel: string }> = [
  { value: "none", label: "None", accessibleLabel: "No symmetry" },
  { value: "horizontal", label: "Horizontal mirror", accessibleLabel: "Horizontal mirror, left and right" },
  { value: "vertical", label: "Vertical mirror", accessibleLabel: "Vertical mirror, top and bottom" },
  { value: "rotational", label: "Rotate 180°", accessibleLabel: "180 degree rotation" },
  { value: "four-way", label: "Four-way", accessibleLabel: "Four-way symmetry" }
];

export function ScenarioBuilder() {
  const initialScenario = useMemo(createScenarioBuilderState, []);
  const [scenario, setScenario] = useState(initialScenario);
  const [history, setHistory] = useState(() => createScenarioGridHistory(initialScenario.grid));
  const [selectedTile, setSelectedTile] = useState<Cell>(null);
  const [announcement, setAnnouncement] = useState("");
  const painting = useRef(false);
  const paintedCells = useRef(new Set<string>());
  const suppressPointerClick = useRef(false);
  const palette = useMemo<Cell[]>(
    () => [
      null,
      ...[1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048].map((value) => ({ t: "n" as const, v: value })),
      { t: "z" },
      ...scenario.config.spawn.wildcardMultipliers.map((multiplier) => ({ t: "w" as const, m: multiplier })),
      { t: "i" }
    ],
    [scenario.config.spawn.wildcardMultipliers]
  );
  const validation = useMemo(
    () => validateScenario(scenario.config, scenario.grid),
    [scenario.config, scenario.grid]
  );

  function updateConfig<K extends keyof GameConfig>(key: K, value: GameConfig[K]) {
    setScenario((current) => ({ ...current, config: { ...current.config, [key]: value } }));
  }

  function updateDimension(key: "width" | "height", value: number) {
    const next = Math.max(MIN_BOARD_SIZE, Math.min(MAX_BOARD_SIZE, value || MIN_BOARD_SIZE));
    setScenario((current) => {
      const config = { ...current.config, [key]: next };
      const grid = resizeScenarioGrid(current.grid, config.height, config.width);
      setHistory(createScenarioGridHistory(grid));
      return {
        ...current,
        config,
        grid
      };
    });
  }

  function updateSpawn(key: keyof GameConfig["spawn"], value: number | number[]) {
    setScenario((current) => ({
      ...current,
      config: { ...current.config, spawn: { ...current.config.spawn, [key]: value } }
    }));
  }

  function selectTile(tile: Cell) {
    setSelectedTile(tile);
    setAnnouncement(`${scenarioTileLabel(tile)} selected`);
  }

  function placeTile(row: number, column: number) {
    const coordinates = scenarioSymmetryCoordinates(
      scenario.config.height,
      scenario.config.width,
      row,
      column,
      scenario.symmetry
    );
    setScenario((current) => {
      const grid = placeScenarioTile(current.grid, row, column, selectedTile, current.symmetry);
      setHistory((currentHistory) => commitScenarioGrid(currentHistory, grid));
      return { ...current, grid };
    });
    const changedCells = coordinates
      .map(([targetRow, targetColumn], index) =>
        `${index === 0 ? "Row" : "row"} ${targetRow + 1}, column ${targetColumn + 1}`
      )
      .join("; ");
    setAnnouncement(`${changedCells} changed to ${scenarioTileLabel(selectedTile)}`);
  }

  function applyHistory(nextHistory: typeof history, message: string) {
    setHistory(nextHistory);
    setScenario((current) => ({ ...current, grid: nextHistory.present }));
    setAnnouncement(message);
  }

  function undo() {
    applyHistory(undoScenarioGrid(history), "Last board change undone");
  }

  function redo() {
    applyHistory(redoScenarioGrid(history), "Last board change redone");
  }

  function reset() {
    const grid = createEmptyScenarioGrid(scenario.config.height, scenario.config.width);
    const nextHistory = commitScenarioGrid(history, grid);
    applyHistory(nextHistory, "Board reset to empty");
  }

  function paintTarget(target: EventTarget | null) {
    const cell = target instanceof Element
      ? target.closest<HTMLElement>("[data-scenario-cell]")
      : null;
    if (!cell) return;
    const row = Number(cell.dataset.row);
    const column = Number(cell.dataset.column);
    const key = `${row}:${column}`;
    if (paintedCells.current.has(key)) return;
    paintedCells.current.add(key);
    placeTile(row, column);
  }

  function startPainting(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    painting.current = true;
    paintedCells.current.clear();
    suppressPointerClick.current = true;
    paintTarget(event.target);
  }

  function paintFromPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (!painting.current) return;
    paintTarget(document.elementFromPoint(event.clientX, event.clientY));
  }

  function stopPainting() {
    painting.current = false;
    paintedCells.current.clear();
    window.setTimeout(() => {
      suppressPointerClick.current = false;
    }, 0);
  }

  return (
    <main className="scenario-builder-page">
      <div className="card scenario-builder-card">
        <header>
          <h1>Scenario Builder</h1>
          <p className="brand-subtitle">Configure a deterministic board before placing tiles.</p>
        </header>

        <div className="scenario-builder-layout">
          <section className="scenario-controls" aria-labelledby="scenario-config-heading">
            <h2 id="scenario-config-heading">Configuration</h2>
            <div className="scenario-field-grid">
              <NumberField label="Columns" value={scenario.config.width} min={MIN_BOARD_SIZE} max={MAX_BOARD_SIZE} onChange={(value) => updateDimension("width", value)} />
              <NumberField label="Rows" value={scenario.config.height} min={MIN_BOARD_SIZE} max={MAX_BOARD_SIZE} onChange={(value) => updateDimension("height", value)} />
              <NumberField label="Seed" value={scenario.config.seed} min={1} onChange={(value) => updateConfig("seed", value)} />
              <NumberField label="Win tile" value={scenario.config.winTile} min={2} onChange={(value) => updateConfig("winTile", value)} />

              <label>
                <span>Game mode</span>
                <select value={scenario.gameMode} onChange={(event) => setScenario((current) => ({ ...current, gameMode: event.target.value as ScenarioGameMode }))}>
                  <option value="classic">Classic</option>
                  <option value="bitstorm">Bitstorm</option>
                </select>
              </label>
              <label>
                <span>Zero behavior</span>
                <select value={scenario.config.zeroBehavior} disabled>
                  <option value="annihilate">Annihilate</option>
                </select>
              </label>
            </div>

            <fieldset>
              <legend>Spawn probabilities</legend>
              <div className="scenario-field-grid">
                <NumberField label="Zero" value={scenario.config.spawn.pZero} min={0} max={1} step={0.01} onChange={(value) => updateSpawn("pZero", value)} />
                <NumberField label="One" value={scenario.config.spawn.pOne} min={0} max={1} step={0.01} onChange={(value) => updateSpawn("pOne", value)} />
                <NumberField label="Wildcard" value={scenario.config.spawn.pWildcard} min={0} max={1} step={0.01} onChange={(value) => updateSpawn("pWildcard", value)} />
                <NumberField label="Lock-0" value={scenario.config.spawn.pLock} min={0} max={1} step={0.01} onChange={(value) => updateSpawn("pLock", value)} />
              </div>
              <label>
                <span>Wildcard multipliers</span>
                <input
                  value={scenario.config.spawn.wildcardMultipliers.join(", ")}
                  onChange={(event) => {
                    const values = event.target.value.split(",").map(Number).filter((value) => Number.isFinite(value) && value > 0);
                    updateSpawn("wildcardMultipliers", values);
                  }}
                  inputMode="numeric"
                />
              </label>
              <label className="scenario-checkbox">
                <input type="checkbox" checked={scenario.config.spawnOnNoopMove} onChange={(event) => updateConfig("spawnOnNoopMove", event.target.checked)} />
                <span>Spawn after a no-op move</span>
              </label>
            </fieldset>
          </section>

          <section className="scenario-board-panel" aria-labelledby="scenario-board-heading">
            <h2 id="scenario-board-heading">Board</h2>
            <p className="scenario-status" role="status">
              {scenario.config.width} × {scenario.config.height} {scenario.gameMode} board
            </p>
            <div className="scenario-palette" role="toolbar" aria-label="Tile palette">
              {palette.map((tile, index) => {
                const label = scenarioTileLabel(tile);
                const selected = label === scenarioTileLabel(selectedTile);
                return (
                  <button
                    key={`${label}-${index}`}
                    type="button"
                    className={selected ? "selected" : undefined}
                    aria-label={label}
                    aria-pressed={selected}
                    onClick={() => selectTile(tile)}
                  >
                    <span aria-hidden="true">{tileSymbol(tile)}</span>
                  </button>
                );
              })}
            </div>
            <p className="scenario-selection">Selected: {scenarioTileLabel(selectedTile)}</p>
            <div className="scenario-symmetry" role="toolbar" aria-label="Placement symmetry">
              {SYMMETRY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={scenario.symmetry === option.value ? "selected" : undefined}
                  aria-label={option.accessibleLabel}
                  aria-pressed={scenario.symmetry === option.value}
                  onClick={() => {
                    setScenario((current) => ({ ...current, symmetry: option.value }));
                    setAnnouncement(`${option.accessibleLabel} selected`);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="scenario-history-actions" role="group" aria-label="Board editing history">
              <button type="button" onClick={undo} disabled={history.past.length === 0}>Undo</button>
              <button type="button" onClick={redo} disabled={history.future.length === 0}>Redo</button>
              <button type="button" onClick={reset}>Reset board</button>
            </div>
            <section className={`scenario-validation ${validation.valid ? "valid" : "invalid"}`} aria-labelledby="scenario-validation-heading">
              <h3 id="scenario-validation-heading">Validation</h3>
              {validation.valid ? (
                <p>Scenario ready. Legal moves: {validation.legalMoves.join(", ")}.</p>
              ) : (
                <ul>
                  {validation.errors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              )}
            </section>
            <div
              className="scenario-board"
              role="grid"
              aria-label={`${scenario.config.width} by ${scenario.config.height} scenario board`}
              style={{ gridTemplateColumns: `repeat(${scenario.config.width}, minmax(0, 1fr))` }}
              onPointerDown={startPainting}
              onPointerMove={paintFromPointer}
              onPointerUp={stopPainting}
              onPointerCancel={stopPainting}
              onPointerLeave={stopPainting}
            >
              {scenario.grid.flatMap((row, rowIndex) =>
                row.map((cell, columnIndex) => (
                  <button
                    type="button"
                    key={`${rowIndex}-${columnIndex}`}
                    className="scenario-cell"
                    role="gridcell"
                    data-scenario-cell
                    data-row={rowIndex}
                    data-column={columnIndex}
                    aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}, ${scenarioTileLabel(cell)}`}
                    onClick={() => {
                      if (suppressPointerClick.current) {
                        suppressPointerClick.current = false;
                        return;
                      }
                      placeTile(rowIndex, columnIndex);
                    }}
                  >
                    <span aria-hidden="true">{tileSymbol(cell)}</span>
                  </button>
                ))
              )}
            </div>
            <p className="game-hint">Choose a tile, then activate a cell or drag across cells to paint. Undo, redo, and reset are available above the board.</p>
            <p className="sr-only scenario-announcement" role="status" aria-live="polite" aria-atomic="true">{announcement}</p>
          </section>
        </div>
      </div>
    </main>
  );
}

function tileSymbol(tile: Cell): string {
  if (tile === null) return "Erase";
  if (tile.t === "n") return String(tile.v);
  if (tile.t === "z") return "0";
  if (tile.t === "w") return `×${tile.m}`;
  return "Lock-0";
}

function NumberField({ label, value, onChange, ...inputProps }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <label>
      <span>{label}</span>
      <input type="number" value={value} onChange={(event) => onChange(event.target.valueAsNumber)} {...inputProps} />
    </label>
  );
}
