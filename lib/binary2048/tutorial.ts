import { applyMove, createGame } from "@/lib/binary2048/engine";
import type { Cell, Dir, GameConfig, GameEvent, GameState } from "@/lib/binary2048/types";

export const TUTORIAL_VERSION = 1;
export const TUTORIAL_STORAGE_KEY = "binary2048.tutorial.v1";
export const TUTORIAL_SUPPRESS_COOKIE = "binary2048_tutorial_suppress";
export const TUTORIAL_SUPPRESS_VALUE = "1";
export const TUTORIAL_SUPPRESS_MAX_AGE_SECONDS = 31_536_000;
export const TUTORIAL_SUCCESS_DURATION_MS = 1_700;

export type TutorialPreference = {
  version: typeof TUTORIAL_VERSION;
  status: "dismissed" | "active" | "completed";
  lessonIndex?: number;
};

export type TutorialLesson = {
  id: string;
  title: string;
  instruction: string;
  hint: string;
  initialGrid: Cell[][];
  expectedMoves: Dir[];
  outcome: string;
  focusCells: Array<[number, number]>;
  tileName?: string;
};

export type TutorialSession = {
  version: typeof TUTORIAL_VERSION;
  lessonIndex: number;
  moveIndex: number;
  phase: "coach" | "active" | "success" | "completed";
  board: GameState;
  feedback: string;
  events: GameEvent[];
};

export type TutorialMoveResult = {
  session: TutorialSession;
  accepted: boolean;
  advanced: boolean;
};

const TUTORIAL_CONFIG: GameConfig = {
  width: 4,
  height: 4,
  seed: 2048,
  winTile: 2048,
  zeroBehavior: "annihilate",
  spawnOnNoopMove: false,
  spawn: {
    pZero: 0,
    pOne: 1,
    pWildcard: 0,
    pLock: 0,
    wildcardMultipliers: [2]
  }
};

const E = null;
const n = (v: number) => ({ t: "n" as const, v });
const z = { t: "z" as const };
const w2 = { t: "w" as const, m: 2 };
const lock = { t: "i" as const };

export const TUTORIAL_LESSONS: readonly TutorialLesson[] = [
  {
    id: "move-left",
    title: "Move left",
    instruction: "Swipe left or press Left/A. Every tile slides together until blocked.",
    hint: "Move the 1 tile toward the left edge.",
    initialGrid: [[E, E, n(1), E], [E, E, E, E], [E, E, E, E], [E, E, E, E]],
    expectedMoves: ["left"],
    outcome: "The tile moved to the left edge.",
    focusCells: [[0, 2]]
  },
  {
    id: "move-right",
    title: "Move right and merge",
    instruction: "Swipe right or press Right/D to combine the two equal number tiles.",
    hint: "Equal number tiles merge when they collide.",
    initialGrid: [[n(1), n(1), E, E], [E, E, E, E], [E, E, E, E], [E, E, E, E]],
    expectedMoves: ["right"],
    outcome: "The two 1 tiles merged into 2.",
    focusCells: [[0, 0], [0, 1]]
  },
  {
    id: "move-up",
    title: "Move up",
    instruction: "Swipe up or press Up/W to move the column upward.",
    hint: "Move the lower tile toward the top edge.",
    initialGrid: [[E, E, E, E], [E, E, E, E], [E, n(2), E, E], [E, E, E, E]],
    expectedMoves: ["up"],
    outcome: "The tile moved to the top edge.",
    focusCells: [[2, 1]]
  },
  {
    id: "move-down",
    title: "Move down",
    instruction: "Swipe down or press Down/S to move the column downward.",
    hint: "Move the upper tile toward the bottom edge.",
    initialGrid: [[E, E, n(2), E], [E, E, E, E], [E, E, E, E], [E, E, E, E]],
    expectedMoves: ["down"],
    outcome: "You have now used all four movement directions.",
    focusCells: [[0, 2]]
  },
  {
    id: "zero",
    title: "Zero annihilator",
    instruction: "Move left to collide the number with 0. Zero removes itself while preserving the number.",
    hint: "Bring the 1 and 0 together by moving left.",
    initialGrid: [[n(1), z, E, E], [E, E, E, E], [E, E, E, E], [E, E, E, E]],
    expectedMoves: ["left"],
    outcome: "Zero disappeared on collision. Two zero tiles would both disappear.",
    focusCells: [[0, 0], [0, 1]],
    tileName: "Zero"
  },
  {
    id: "wildcard",
    title: "Wildcard multiplier",
    instruction: "Move left to merge the 2× wildcard with the number tile.",
    hint: "A 2× wildcard doubles the number it touches.",
    initialGrid: [[n(8), w2, E, E], [E, E, E, E], [E, E, E, E], [E, E, E, E]],
    expectedMoves: ["left"],
    outcome: "The 2× wildcard multiplied 8 into 16.",
    focusCells: [[0, 0], [0, 1]],
    tileName: "2× wildcard"
  },
  {
    id: "lock-zero",
    title: "Lock-0",
    instruction: "Move right, then left. Lock-0 blocks its first collision and breaks like zero on the next moved turn.",
    hint: "Right creates the blocked collision; left returns for the break.",
    initialGrid: [[lock, n(8), E, E], [E, E, E, E], [E, E, E, E], [E, E, E, E]],
    expectedMoves: ["right", "left"],
    outcome: "Lock-0 blocked once, then broke and behaved like zero.",
    focusCells: [[0, 0], [0, 1]],
    tileName: "Lock-0"
  },
  {
    id: "mixed-practice",
    title: "Mixed special-tile practice",
    instruction: "Move left to resolve a number merge, a zero collision, and a wildcard collision together.",
    hint: "Read each row independently, then move every row left.",
    initialGrid: [
      [n(2), n(2), E, E],
      [n(4), z, E, E],
      [n(8), w2, E, E],
      [E, E, E, E]
    ],
    expectedMoves: ["left"],
    outcome: "One move resolved ordinary and special-tile collisions in separate rows.",
    focusCells: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]],
    tileName: "Special tiles"
  },
  {
    id: "build-2048",
    title: "Build toward 2048",
    instruction: "Move left to turn two 512 tiles into a second 1024 tile.",
    hint: "The new 1024 cannot merge again during the same move.",
    initialGrid: [[n(512), n(512), n(1024), E], [E, E, E, E], [E, E, E, E], [E, E, E, E]],
    expectedMoves: ["left"],
    outcome: "Two 1024 tiles are ready for the final lesson.",
    focusCells: [[0, 0], [0, 1], [0, 2]]
  },
  {
    id: "create-2048",
    title: "Create 2048",
    instruction: "Move left one last time to create the 2048 tile.",
    hint: "Merge the matching 1024 tiles.",
    initialGrid: [[n(1024), n(1024), E, E], [E, E, E, E], [E, E, E, E], [E, E, E, E]],
    expectedMoves: ["left"],
    outcome: "You created 2048 and completed the tutorial.",
    focusCells: [[0, 0], [0, 1]]
  }
] as const;

function cloneGrid(grid: Cell[][]): Cell[][] {
  return grid.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function createLessonBoard(lessonIndex: number): GameState {
  const lesson = TUTORIAL_LESSONS[lessonIndex];
  if (!lesson) throw new Error(`Unknown tutorial lesson: ${lessonIndex}`);
  const created = createGame(
    { ...TUTORIAL_CONFIG, seed: TUTORIAL_CONFIG.seed + lessonIndex },
    cloneGrid(lesson.initialGrid)
  ).state;
  return { ...created, id: `tutorial-v${TUTORIAL_VERSION}-${lesson.id}`, over: false };
}

function applyWithoutSpawn(board: GameState, dir: Dir) {
  const result = applyMove(board, dir);
  const grid = cloneGrid(result.state.grid);
  for (const event of result.events) {
    if (event.type === "spawn") grid[event.at[0]][event.at[1]] = null;
  }
  return {
    state: { ...result.state, grid, rngStep: board.rngStep, over: false },
    moved: result.moved,
    events: result.events.filter((event) => event.type !== "spawn" && event.type !== "game_over")
  };
}

export function createTutorialSession(lessonIndex = 0): TutorialSession {
  const safeIndex = Math.max(0, Math.min(TUTORIAL_LESSONS.length - 1, Math.floor(lessonIndex)));
  return {
    version: TUTORIAL_VERSION,
    lessonIndex: safeIndex,
    moveIndex: 0,
    phase: "coach",
    board: createLessonBoard(safeIndex),
    feedback: "",
    events: []
  };
}

export function applyTutorialMove(session: TutorialSession, dir: Dir): TutorialMoveResult {
  if (session.phase !== "active") return { session, accepted: false, advanced: false };
  const lesson = TUTORIAL_LESSONS[session.lessonIndex];
  const expected = lesson.expectedMoves[session.moveIndex];
  if (dir !== expected) {
    return {
      session: { ...session, feedback: `Try ${expected}.`, events: [] },
      accepted: false,
      advanced: false
    };
  }

  const result = applyWithoutSpawn(session.board, dir);
  const nextMoveIndex = session.moveIndex + 1;
  const lessonDone = nextMoveIndex >= lesson.expectedMoves.length;
  const finalLesson = session.lessonIndex === TUTORIAL_LESSONS.length - 1;
  return {
    session: {
      ...session,
      board: result.state,
      moveIndex: nextMoveIndex,
      phase: finalLesson && lessonDone ? "completed" : "success",
      feedback: lessonDone ? `Good job! ${lesson.outcome}` : "Good job! Lock-0 blocked the first collision.",
      events: result.events
    },
    accepted: true,
    advanced: lessonDone
  };
}

export function continueTutorial(session: TutorialSession): TutorialSession {
  if (session.phase !== "success") return session;
  const lesson = TUTORIAL_LESSONS[session.lessonIndex];
  if (session.moveIndex < lesson.expectedMoves.length) {
    return { ...session, phase: "coach", feedback: "", events: [] };
  }
  return createTutorialSession(session.lessonIndex + 1);
}

export function armTutorial(session: TutorialSession): TutorialSession {
  return session.phase === "coach" ? { ...session, phase: "active", feedback: "" } : session;
}

export function tutorialExpectedDirection(session: TutorialSession): Dir {
  return TUTORIAL_LESSONS[session.lessonIndex].expectedMoves[session.moveIndex];
}

export function hasTutorialSuppressCookie(cookieHeader: string): boolean {
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .some((part) => part === `${TUTORIAL_SUPPRESS_COOKIE}=${TUTORIAL_SUPPRESS_VALUE}`);
}

export function tutorialSuppressCookie(secure: boolean): string {
  return [
    `${TUTORIAL_SUPPRESS_COOKIE}=${TUTORIAL_SUPPRESS_VALUE}`,
    "Path=/",
    `Max-Age=${TUTORIAL_SUPPRESS_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
    ...(secure ? ["Secure"] : [])
  ].join("; ");
}

export function clearTutorialSuppressCookie(secure: boolean): string {
  return [
    `${TUTORIAL_SUPPRESS_COOKIE}=`,
    "Path=/",
    "Max-Age=0",
    "SameSite=Lax",
    ...(secure ? ["Secure"] : [])
  ].join("; ");
}

export function tutorialPreference(status: TutorialPreference["status"], lessonIndex?: number): TutorialPreference {
  return {
    version: TUTORIAL_VERSION,
    status,
    ...(typeof lessonIndex === "number" ? { lessonIndex } : {})
  };
}

export function parseTutorialPreference(raw: string | null): TutorialPreference | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TutorialPreference>;
    if (value.version !== TUTORIAL_VERSION) return null;
    if (value.status !== "dismissed" && value.status !== "active" && value.status !== "completed") return null;
    if (value.status === "active") {
      if (!Number.isInteger(value.lessonIndex) || Number(value.lessonIndex) < 0 || Number(value.lessonIndex) >= TUTORIAL_LESSONS.length) {
        return null;
      }
    }
    return value as TutorialPreference;
  } catch {
    return null;
  }
}

export function shouldOfferTutorial(preference: TutorialPreference | null, hasRecoverableGame: boolean): boolean {
  return !preference && !hasRecoverableGame;
}
