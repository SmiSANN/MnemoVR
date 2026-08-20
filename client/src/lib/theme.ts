import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const themePreferences = ["default", "white", "black", "pink", "blue"] as const;

export type ThemePreference = (typeof themePreferences)[number];
export type WindowColorScheme = "light" | "dark";

const THEME_CACHE_KEY = "mnemovr-theme";
export const DEFAULT_THEME: ThemePreference = "default";

export function isThemePreference(value: string | null): value is ThemePreference {
  return themePreferences.includes(value as ThemePreference);
}

export function getCachedThemePreference(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_THEME;

  try {
    const cached = window.localStorage.getItem(THEME_CACHE_KEY);
    return isThemePreference(cached) ? cached : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function cacheThemePreference(theme: ThemePreference): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(THEME_CACHE_KEY, theme);
  } catch {
    // SQLite にも保存するため、localStorage が使えない環境ではキャッシュだけ諦める。
  }
}

export function getWindowColorScheme(theme: ThemePreference): WindowColorScheme {
  return theme === "default" || theme === "black" ? "dark" : "light";
}

export function applyDocumentTheme(theme: ThemePreference): void {
  if (typeof document === "undefined") return;

  const colorScheme = getWindowColorScheme(theme);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.colorScheme = colorScheme;
  document.documentElement.style.colorScheme = colorScheme;
}

export async function applyWindowTheme(theme: ThemePreference): Promise<void> {
  if (!isTauri()) return;
  await getCurrentWindow().setTheme(getWindowColorScheme(theme));
}
