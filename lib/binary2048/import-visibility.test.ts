import { shouldShowImportJson } from "@/lib/binary2048/import-visibility";

describe("shouldShowImportJson", () => {
  it("shows import only when the control is enabled and the user is authenticated", () => {
    expect(shouldShowImportJson(true, true)).toBe(true);
    expect(shouldShowImportJson(true, false)).toBe(false);
    expect(shouldShowImportJson(false, true)).toBe(false);
    expect(shouldShowImportJson(false, false)).toBe(false);
  });
});
