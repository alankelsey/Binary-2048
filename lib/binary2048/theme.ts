export const THEMES = {
  classic: { label: "Original" },
  midnight: { label: "Deep Midnight" },
  aurora: { label: "Aurora" },
  ember: { label: "Ember" },
  light: { label: "Light" }
} as const;

export const BOARD_BACKGROUNDS = {
  default: { label: "Default" },
  cherryBlossom: { label: "Cherry Blossom" }
} as const;

export const TILE_STYLES = {
  normal: { label: "Normal" },
  opaque: { label: "Opaque" }
} as const;

export type ThemeMode = keyof typeof THEMES;
export type BoardBackground = keyof typeof BOARD_BACKGROUNDS;
export type TileStyle = keyof typeof TILE_STYLES;

export function isThemeMode(value: string | null): value is ThemeMode {
  return Boolean(value && Object.prototype.hasOwnProperty.call(THEMES, value));
}

export function isBoardBackground(value: string | null): value is BoardBackground {
  return Boolean(value && Object.prototype.hasOwnProperty.call(BOARD_BACKGROUNDS, value));
}

export function isTileStyle(value: string | null): value is TileStyle {
  return Boolean(value && Object.prototype.hasOwnProperty.call(TILE_STYLES, value));
}

export function isCssHexColor(value: string | null): value is string {
  return Boolean(value && /^#[0-9a-f]{6}$/i.test(value));
}

export function readableTextColor(background: string): "#241719" | "#fffdf8" {
  if (!isCssHexColor(background)) return "#241719";
  const channels = [1, 3, 5].map((offset) => Number.parseInt(background.slice(offset, offset + 2), 16));
  const luminance = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 1000;
  return luminance >= 150 ? "#241719" : "#fffdf8";
}
