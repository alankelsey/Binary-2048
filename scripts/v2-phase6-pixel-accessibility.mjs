#!/usr/bin/env node

import http from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const WebSocket = require("next/dist/compiled/ws");
const endpoint = process.env.BINARY2048_CDP_ENDPOINT ?? "http://127.0.0.1:9222";
const targetUrl = process.env.BINARY2048_PIXEL_URL ?? "https://www.binary2048.com/";
const expectedCommit = process.env.BINARY2048_EXPECT_COMMIT;

function getJson(path) {
  return new Promise((resolve, reject) => {
    const request = http.get(`${endpoint}${path}`, response => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", chunk => { body += chunk; });
      response.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
  });
}

const version = await getJson("/json/version");
if (typeof version.webSocketDebuggerUrl !== "string") {
  throw new Error("Pixel Chrome did not provide a browser debugging endpoint");
}

const socket = new WebSocket(version.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();

socket.on("message", data => {
  const message = JSON.parse(data.toString());
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject, timer } = pending.get(message.id);
  clearTimeout(timer);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

await new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Pixel Chrome debugging approval timed out")), 55_000);
  socket.once("open", () => {
    clearTimeout(timer);
    resolve();
  });
  socket.once("error", error => {
    clearTimeout(timer);
    reject(error);
  });
});

function command(method, params = {}, sessionId, timeoutMs = 15_000) {
  return new Promise((resolve, reject) => {
    const id = nextId++;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

const { targetInfos } = await command("Target.getTargets");
const matches = targetInfos.filter(target =>
  target.type === "page" && target.title === "Binary 2048" && target.url === targetUrl
);
if (matches.length !== 1) {
  socket.close();
  throw new Error(`Expected exactly one Binary 2048 tab at ${targetUrl}; found ${matches.length}`);
}

const { sessionId } = await command("Target.attachToTarget", {
  targetId: matches[0].targetId,
  flatten: true
});

let output;
try {
  const evaluated = await command("Runtime.evaluate", {
    expression: `(() => {
      const rect = selector => {
        const node = document.querySelector(selector);
        if (!(node instanceof HTMLElement)) return null;
        const value = node.getBoundingClientRect();
        return {
          left: Math.round(value.left * 100) / 100,
          top: Math.round(value.top * 100) / 100,
          right: Math.round(value.right * 100) / 100,
          bottom: Math.round(value.bottom * 100) / 100,
          width: Math.round(value.width * 100) / 100,
          height: Math.round(value.height * 100) / 100
        };
      };
      const versionText = document.querySelector('[aria-label="app version"]')?.textContent ?? '';
      const commit = versionText.match(/\\(([a-f0-9]{7,40}|dev)\\)/)?.[1] ?? null;
      const viewport = {
        width: window.visualViewport?.width ?? innerWidth,
        height: window.visualViewport?.height ?? innerHeight,
        offsetLeft: window.visualViewport?.offsetLeft ?? 0,
        offsetTop: window.visualViewport?.offsetTop ?? 0
      };
      const board = rect('.board');
      const dock = rect('.actions-primary');
      const main = document.querySelector('main');
      const dockNode = document.querySelector('.actions-primary');
      const insideViewport = value => Boolean(value) &&
        value.left >= viewport.offsetLeft - 1 &&
        value.right <= viewport.offsetLeft + viewport.width + 1 &&
        value.top >= viewport.offsetTop - 1 &&
        value.bottom <= viewport.offsetTop + viewport.height + 1;
      return {
        commit,
        portrait: matchMedia('(orientation: portrait)').matches,
        reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
        visibility: document.visibilityState,
        viewport,
        board,
        dock,
        dockInsideViewport: insideViewport(dock),
        boardDoesNotOverlapDock: Boolean(board && dock && board.bottom <= dock.top + 1),
        mainPaddingBottom: main ? getComputedStyle(main).paddingBottom : null,
        dockPaddingBottom: dockNode ? getComputedStyle(dockNode).paddingBottom : null,
        gridCells: document.querySelectorAll('[role="gridcell"]').length,
        moveButtons: document.querySelectorAll('[aria-label^="Move "]').length
      };
    })()`,
    returnByValue: true
  }, sessionId);
  if (evaluated.exceptionDetails) {
    throw new Error(evaluated.exceptionDetails.exception?.description ?? "Pixel geometry evaluation failed");
  }
  const geometry = evaluated.result?.value;
  if (!geometry?.commit || !geometry.portrait || geometry.visibility !== "visible" ||
      geometry.gridCells !== 16 || ![0, 4].includes(geometry.moveButtons) || !geometry.dockInsideViewport ||
      !geometry.boardDoesNotOverlapDock) {
    throw new Error(`Pixel layout is not ready for acceptance: ${JSON.stringify(geometry)}`);
  }

  await command("Accessibility.enable", {}, sessionId);
  const { nodes } = await command("Accessibility.getFullAXTree", {}, sessionId);
  const role = node => node.role?.value;
  const name = node => node.name?.value;
  const property = (node, propertyName) =>
    node.properties?.find(item => item.name === propertyName)?.value?.value;
  const grid = nodes.filter(node => role(node) === "grid" && name(node) === "Binary 2048 game board");
  const cells = nodes.filter(node => role(node) === "gridcell");
  const moveButtons = nodes.filter(node => role(node) === "button" && /^Move (up|down|left|right)$/.test(name(node) ?? ""));
  const liveRegions = nodes.filter(node => ["polite", "assertive"].includes(property(node, "live")));
  const unnamedCells = cells.filter(node => !/^row [1-4] column [1-4] /.test(name(node) ?? ""));
  const accessibility = {
    boardGridCount: grid.length,
    namedGridCellCount: cells.length - unnamedCells.length,
    moveButtonCount: moveButtons.length,
    liveRegionCount: liveRegions.length
  };
  if (accessibility.boardGridCount !== 1 || accessibility.namedGridCellCount !== 16 ||
      accessibility.moveButtonCount !== geometry.moveButtons || accessibility.liveRegionCount < 1) {
    throw new Error(`Pixel accessibility tree failed acceptance: ${JSON.stringify(accessibility)}`);
  }
  output = {
    schemaVersion: 1,
    context: {
      target: "Binary 2048 production root",
      orientation: "portrait",
      authenticated: false,
      deployedCommit: geometry.commit,
      metricLimit: "DOM geometry and aggregate Chrome accessibility-tree roles; not TalkBack speech output"
    },
    geometry: {
      viewport: geometry.viewport,
      board: geometry.board,
      dock: geometry.dock,
      dockInsideViewport: geometry.dockInsideViewport,
      boardDoesNotOverlapDock: geometry.boardDoesNotOverlapDock,
      mainPaddingBottom: geometry.mainPaddingBottom,
      dockPaddingBottom: geometry.dockPaddingBottom
    },
    accessibility
  };
} finally {
  try {
    await command("Accessibility.disable", {}, sessionId);
    await command("Target.detachFromTarget", { sessionId });
  } finally {
    socket.close();
  }
}

if (expectedCommit && output.context.deployedCommit !== expectedCommit &&
    !expectedCommit.startsWith(output.context.deployedCommit) &&
    !output.context.deployedCommit.startsWith(expectedCommit)) {
  throw new Error(`Expected deployed commit ${expectedCommit}, received ${output.context.deployedCommit}`);
}

console.log(JSON.stringify(output, null, 2));
