import {
  exitDocumentFullscreen,
  isFullscreenActive,
  isFullscreenSupported,
  requestElementFullscreen
} from "@/lib/binary2048/fullscreen";

describe("fullscreen helpers", () => {
  it("detects support from standard or webkit fullscreen methods", () => {
    expect(isFullscreenSupported(null)).toBe(false);
    expect(isFullscreenSupported({ requestFullscreen: async () => {} } as unknown as HTMLElement)).toBe(true);
    expect(isFullscreenSupported({ webkitRequestFullscreen: async () => {} } as unknown as HTMLElement)).toBe(true);
  });

  it("detects active fullscreen from document state", () => {
    expect(isFullscreenActive({ fullscreenElement: null } as unknown as Document)).toBe(false);
    expect(isFullscreenActive({ fullscreenElement: {} as Element } as unknown as Document)).toBe(true);
    expect(isFullscreenActive({ webkitFullscreenElement: {} as Element } as unknown as Document)).toBe(true);
  });

  it("requests and exits fullscreen using available APIs", async () => {
    const requestFullscreen = jest.fn().mockResolvedValue(undefined);
    const exitFullscreen = jest.fn().mockResolvedValue(undefined);

    await expect(requestElementFullscreen({ requestFullscreen } as unknown as HTMLElement)).resolves.toBe(true);
    await expect(exitDocumentFullscreen({ exitFullscreen } as unknown as Document)).resolves.toBe(true);

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });
});
