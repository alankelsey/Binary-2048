import { parseAction, toActionCode } from "@/lib/binary2048/action";

describe("action codec", () => {
  it("maps dirs to action codes", () => {
    expect(toActionCode("left")).toBe("L");
    expect(toActionCode("right")).toBe("R");
    expect(toActionCode("up")).toBe("U");
    expect(toActionCode("down")).toBe("D");
  });

  it("parses both full and compact actions", () => {
    expect(parseAction("left")).toBe("left");
    expect(parseAction("R")).toBe("right");
    expect(parseAction("U")).toBe("up");
    expect(parseAction("down")).toBe("down");
  });

  it("returns null for invalid input", () => {
    expect(parseAction("x")).toBeNull();
    expect(parseAction(42)).toBeNull();
    expect(parseAction(undefined)).toBeNull();
  });
});
