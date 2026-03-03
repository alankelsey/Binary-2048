export const THEMES = {
  midnight: { label: "Midnight" },
  aurora: { label: "Aurora" },
  ember: { label: "Ember" },
  light: { label: "Light" }
} as const;

export type ThemeMode = keyof typeof THEMES;

export function isThemeMode(value: string | null): value is ThemeMode {
  return Boolean(value && Object.prototype.hasOwnProperty.call(THEMES, value));
}
