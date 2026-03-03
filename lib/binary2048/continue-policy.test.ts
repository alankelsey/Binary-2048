import { canContinueAfterWin } from "@/lib/binary2048/continue-policy";

describe("continue policy", () => {
  it("allows continue after win for unranked/free play", () => {
    expect(canContinueAfterWin("unranked")).toBe(true);
  });

  it("disables continue after win for ranked/vs play by default", () => {
    expect(canContinueAfterWin("ranked")).toBe(false);
  });
});
