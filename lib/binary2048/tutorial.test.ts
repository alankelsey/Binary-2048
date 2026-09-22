import {
  TUTORIAL_LESSONS,
  TUTORIAL_SUCCESS_DURATION_MS,
  TUTORIAL_VERSION,
  applyTutorialMove,
  armTutorial,
  clearTutorialSuppressCookie,
  continueTutorial,
  createTutorialSession,
  hasTutorialSuppressCookie,
  parseTutorialPreference,
  shouldOfferTutorial,
  tutorialPreference,
  tutorialSuppressCookie
} from "@/lib/binary2048/tutorial";

describe("guided tutorial", () => {
  it("keeps successful-step feedback visible for 1.7 seconds", () => {
    expect(TUTORIAL_SUCCESS_DURATION_MS).toBe(1_700);
  });

  it("uses ten versioned lessons covering every direction and special tile", () => {
    expect(TUTORIAL_VERSION).toBe(1);
    expect(TUTORIAL_LESSONS).toHaveLength(10);
    const directions = new Set(TUTORIAL_LESSONS.flatMap((lesson) => lesson.expectedMoves));
    expect(directions).toEqual(new Set(["left", "right", "up", "down"]));
    const tiles = TUTORIAL_LESSONS.flatMap((lesson) => lesson.initialGrid.flat()).filter(Boolean);
    expect(tiles).toEqual(expect.arrayContaining([{ t: "z" }, { t: "w", m: 2 }, { t: "i" }]));
    for (const lesson of TUTORIAL_LESSONS) {
      expect(lesson.focusCells.length).toBeGreaterThan(0);
      for (const [row, col] of lesson.focusCells) {
        expect(row).toBeGreaterThanOrEqual(0);
        expect(row).toBeLessThan(4);
        expect(col).toBeGreaterThanOrEqual(0);
        expect(col).toBeLessThan(4);
        expect(lesson.initialGrid[row][col]).not.toBeNull();
      }
    }
  });

  it("rejects an unexpected move without mutating or advancing the board", () => {
    const session = armTutorial(createTutorialSession());
    const before = session.board.grid;
    const result = applyTutorialMove(session, "right");

    expect(result.accepted).toBe(false);
    expect(result.session.lessonIndex).toBe(0);
    expect(result.session.moveIndex).toBe(0);
    expect(result.session.board.grid).toBe(before);
    expect(result.session.feedback).toContain("Try left");
  });

  it("advances only after the lesson's expected move sequence", () => {
    let session = armTutorial(createTutorialSession(6));
    const blocked = applyTutorialMove(session, "right");
    expect(blocked.accepted).toBe(true);
    expect(blocked.advanced).toBe(false);
    expect(blocked.session.events).toContainEqual(expect.objectContaining({ type: "lock_block" }));

    session = armTutorial(continueTutorial(blocked.session));
    const broken = applyTutorialMove(session, "left");
    expect(broken.advanced).toBe(true);
    expect(broken.session.phase).toBe("success");
    expect(broken.session.events).toContainEqual(expect.objectContaining({ type: "lock_break" }));
    expect(continueTutorial(broken.session).lessonIndex).toBe(7);
  });

  it("runs every authored lesson deterministically without random spawn tiles", () => {
    for (let lessonIndex = 0; lessonIndex < TUTORIAL_LESSONS.length; lessonIndex += 1) {
      let session = createTutorialSession(lessonIndex);
      for (const dir of TUTORIAL_LESSONS[lessonIndex].expectedMoves) {
        session = armTutorial(session);
        const result = applyTutorialMove(session, dir);
        expect(result.accepted).toBe(true);
        expect(result.session.events.some((event) => event.type === "spawn")).toBe(false);
        session = result.session.phase === "success" ? continueTutorial(result.session) : result.session;
      }
      expect(["coach", "completed"]).toContain(session.phase);
    }
  });

  it("finishes only after creating a 2048 tile", () => {
    const finalIndex = TUTORIAL_LESSONS.length - 1;
    const result = applyTutorialMove(armTutorial(createTutorialSession(finalIndex)), "left");

    expect(result.session.phase).toBe("completed");
    expect(result.session.board.won).toBe(true);
    expect(result.session.board.grid.flat()).toContainEqual({ t: "n", v: 2048 });
  });

  it("serializes and recognizes only the tutorial suppression cookie", () => {
    const cookie = tutorialSuppressCookie(true);
    expect(cookie).toContain("binary2048_tutorial_suppress=1");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
    expect(hasTutorialSuppressCookie(`theme=dark; ${cookie}`)).toBe(true);
    expect(hasTutorialSuppressCookie("binary2048_tutorial_suppress=0")).toBe(false);
    expect(clearTutorialSuppressCookie(false)).toContain("Max-Age=0");
  });

  it("parses only current-version preferences and offers on a true first visit", () => {
    const active = tutorialPreference("active", 3);
    expect(parseTutorialPreference(JSON.stringify(active))).toEqual(active);
    expect(parseTutorialPreference(JSON.stringify({ version: 0, status: "completed" }))).toBeNull();
    expect(parseTutorialPreference(JSON.stringify({ version: 1, status: "active", lessonIndex: 99 }))).toBeNull();
    expect(shouldOfferTutorial(null, false)).toBe(true);
    expect(shouldOfferTutorial(null, true)).toBe(false);
    expect(shouldOfferTutorial(tutorialPreference("dismissed"), false)).toBe(false);
    expect(shouldOfferTutorial(tutorialPreference("completed"), false)).toBe(false);
  });
});
