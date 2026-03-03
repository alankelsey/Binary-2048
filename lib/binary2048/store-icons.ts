export type ItemRarity = "common" | "rare" | "epic" | "legendary";
export type ItemKind = "boost" | "impediment" | "cosmetic";

export type StoreItemIcon = {
  id: string;
  label: string;
  glyph: string;
  kind: ItemKind;
  rarity: ItemRarity;
};

export const STORE_ITEM_ICONS: StoreItemIcon[] = [
  { id: "boost-wild", label: "Wild Boost", glyph: "✦", kind: "boost", rarity: "rare" },
  { id: "boost-undo", label: "Undo Charge", glyph: "↶", kind: "boost", rarity: "epic" },
  { id: "impede-lock0", label: "Lock-0", glyph: "⛓", kind: "impediment", rarity: "epic" },
  { id: "impede-jam", label: "Jam Tile", glyph: "⛔", kind: "impediment", rarity: "rare" },
  { id: "skin-grid", label: "Grid Skin", glyph: "▦", kind: "cosmetic", rarity: "common" },
  { id: "theme-pack", label: "Theme Pack", glyph: "◈", kind: "cosmetic", rarity: "legendary" }
];

export function rarityCssClass(rarity: ItemRarity): string {
  return `rarity-${rarity}`;
}
