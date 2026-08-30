import { getNewGameStartAction } from "@/lib/binary2048/startup-new-game";

describe("startup new-game action", () => {
  it("queues a tap while initial recovery is busy and no game is visible", () => {
    expect(
      getNewGameStartAction({ busy: true, initializing: true, gameId: "" })
    ).toBe("queue");
  });

  it("starts immediately after initialization finishes", () => {
    expect(
      getNewGameStartAction({ busy: false, initializing: false, gameId: "" })
    ).toBe("start");
  });

  it("ignores overlapping actions outside startup", () => {
    expect(
      getNewGameStartAction({ busy: true, initializing: false, gameId: "g_active" })
    ).toBe("ignore");
  });
});

