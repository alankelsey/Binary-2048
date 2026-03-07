import { isDevNavEnabled } from "@/lib/binary2048/dev-nav";

describe("isDevNavEnabled", () => {
  it("is enabled by default in non-production", () => {
    expect(isDevNavEnabled({ nodeEnv: "development", forceFlag: "" })).toBe(true);
  });

  it("is disabled by default in production", () => {
    expect(isDevNavEnabled({ nodeEnv: "production", forceFlag: "" })).toBe(false);
  });

  it("respects explicit override flag", () => {
    expect(isDevNavEnabled({ nodeEnv: "production", forceFlag: "1" })).toBe(true);
    expect(isDevNavEnabled({ nodeEnv: "development", forceFlag: "false" })).toBe(false);
  });
});
