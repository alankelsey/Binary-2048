import { filenameFromDisposition } from "@/lib/binary2048/browser-actions";

describe("browser actions", () => {
  it("reads a JSON download filename from Content-Disposition", () => {
    expect(filenameFromDisposition('attachment; filename="g_123-2026-09-16.json"', "fallback.json")).toBe(
      "g_123-2026-09-16.json"
    );
  });

  it("uses the fallback when Content-Disposition has no filename", () => {
    expect(filenameFromDisposition(null, "fallback.json")).toBe("fallback.json");
    expect(filenameFromDisposition("attachment", "fallback.json")).toBe("fallback.json");
  });
});
