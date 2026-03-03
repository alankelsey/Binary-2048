import { rarityCssClass, STORE_ITEM_ICONS } from "@/lib/binary2048/store-icons";

describe("store icons", () => {
  it("defines a stable catalog of ids and rarities", () => {
    const ids = STORE_ITEM_ICONS.map((item) => item.id);
    expect(ids).toContain("boost-wild");
    expect(ids).toContain("impede-lock0");
    expect(ids).toContain("theme-pack");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("maps rarity to css class names", () => {
    expect(rarityCssClass("common")).toBe("rarity-common");
    expect(rarityCssClass("rare")).toBe("rarity-rare");
    expect(rarityCssClass("epic")).toBe("rarity-epic");
    expect(rarityCssClass("legendary")).toBe("rarity-legendary");
  });
});
