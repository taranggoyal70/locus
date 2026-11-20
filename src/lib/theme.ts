/**
 * Colour theme preference. "system" follows the operating system; "light" and
 * "dark" pin the theme by setting data-theme on <html>, which globals.css reads.
 */
export type ThemePreference = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "locus-theme";

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * Runs before first paint so a pinned theme never flashes the other one.
 * Storage can throw (private windows, blocked site data); the page then simply
 * follows the system theme.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}})();`;

export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The choice still applies for this page view.
  }
}

export function readThemePreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}
