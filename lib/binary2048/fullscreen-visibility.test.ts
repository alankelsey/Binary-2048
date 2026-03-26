import { isFullscreenToggleEnabled } from "@/lib/binary2048/fullscreen-visibility";

describe("isFullscreenToggleEnabled", () => {
  it("is enabled in local dev-like environments", () => {
    expect(isFullscreenToggleEnabled({ nodeEnv: "development" })).toBe(true);
    expect(isFullscreenToggleEnabled({ nodeEnv: "test" })).toBe(true);
  });

  it("is disabled in production", () => {
    expect(isFullscreenToggleEnabled({ nodeEnv: "production" })).toBe(false);
  });
});
