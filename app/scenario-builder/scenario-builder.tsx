"use client";

import { useMemo, useState } from "react";
import {
  createScenarioBuilderState,
  placeScenarioTile,
  resizeScenarioGrid,
  scenarioTileLabel,
  type ScenarioGameMode
} from "@/lib/binary2048/scenario-builder";
import type { Cell, GameConfig } from "@/lib/binary2048/types";

const MIN_BOARD_SIZE = 2;
const MAX_BOARD_SIZE = 8;

export function ScenarioBuilder() {
  const [scenario, setScenario] = useState(createScenarioBuilderState);
  const [selectedTile, setSelectedTile] = useState<Cell>(null);
  const [announcement, setAnnouncement] = useState("Empty tile selected");
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

  function updateConfig<K extends keyof GameConfig>(key: K, value: GameConfig[K]) {
    setScenario((current) => ({ ...current, config: { ...current.config, [key]: value } }));
  }

  function updateDimension(key: "width" | "height", value: number) {
    const next = Math.max(MIN_BOARD_SIZE, Math.min(MAX_BOARD_SIZE, value || MIN_BOARD_SIZE));
    setScenario((current) => {
      const config = { ...current.config, [key]: next };
      return {
        ...current,
        config,
        grid: resizeScenarioGrid(current.grid, config.height, config.width)
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
    setScenario((current) => ({
      ...current,
      grid: placeScenarioTile(current.grid, row, column, selectedTile)
    }));
    setAnnouncement(
      `Row ${row + 1}, column ${column + 1} changed to ${scenarioTileLabel(selectedTile)}`
    );
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
                    aria-pressed={selected}
                    onClick={() => selectTile(tile)}
                  >
                    {tileSymbol(tile)}
                    <span className="sr-only">{label}</span>
                  </button>
                );
              })}
            </div>
            <p className="scenario-selection">Selected: {scenarioTileLabel(selectedTile)}</p>
            <div
              className="scenario-board"
              role="grid"
              aria-label={`${scenario.config.width} by ${scenario.config.height} scenario board`}
              style={{ gridTemplateColumns: `repeat(${scenario.config.width}, minmax(0, 1fr))` }}
            >
              {scenario.grid.flatMap((row, rowIndex) =>
                row.map((cell, columnIndex) => (
                  <button
                    type="button"
                    key={`${rowIndex}-${columnIndex}`}
                    className="scenario-cell"
                    role="gridcell"
                    aria-label={`Row ${rowIndex + 1}, column ${columnIndex + 1}, ${scenarioTileLabel(cell)}`}
                    onClick={() => placeTile(rowIndex, columnIndex)}
                  >
                    <span aria-hidden="true">{tileSymbol(cell)}</span>
                  </button>
                ))
              )}
            </div>
            <p className="game-hint">Choose a tile, then activate any cell to place, replace, or erase it.</p>
            <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
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
