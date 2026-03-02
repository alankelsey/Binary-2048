import { keyToDir, swipeToDir } from "@/lib/binary2048/input";

describe("input mapping", () => {
  it("maps arrow keys and WASD to directions", () => {
    expect(keyToDir("ArrowUp")).toBe("up");
    expect(keyToDir("ArrowDown")).toBe("down");
    expect(keyToDir("ArrowLeft")).toBe("left");
    expect(keyToDir("ArrowRight")).toBe("right");
    expect(keyToDir("w")).toBe("up");
    expect(keyToDir("a")).toBe("left");
    expect(keyToDir("s")).toBe("down");
    expect(keyToDir("d")).toBe("right");
    expect(keyToDir("W")).toBe("up");
    expect(keyToDir("A")).toBe("left");
    expect(keyToDir("S")).toBe("down");
    expect(keyToDir("D")).toBe("right");
    expect(keyToDir("x")).toBeNull();
  });

  it("maps swipe deltas to directions with threshold", () => {
    expect(swipeToDir(30, 4)).toBe("right");
    expect(swipeToDir(-40, 3)).toBe("left");
    expect(swipeToDir(2, 50)).toBe("down");
    expect(swipeToDir(1, -30)).toBe("up");
    expect(swipeToDir(5, 6, 24)).toBeNull();
  });
});
