// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { THEME_BOOT_SCRIPT, THEME_STORAGE_KEY, applyThemePreference, readThemePreference } from "@/lib/theme";

/** Runs the boot script the way the page does: as a script, before anything else touches the theme. */
const boot = () => {
  delete document.documentElement.dataset.theme;
  new Function(THEME_BOOT_SCRIPT)();
  return document.documentElement.dataset.theme;
};

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("the theme boot script", () => {
  it("pins the theme the switch saved, under the key the switch writes", () => {
    applyThemePreference("dark");
    expect(boot()).toBe("dark");
    applyThemePreference("light");
    expect(boot()).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });

  it("follows the system for System, nothing saved, or anything else in storage", () => {
    applyThemePreference("system");
    expect(boot()).toBeUndefined();
    expect(readThemePreference()).toBe("system");

    localStorage.setItem(THEME_STORAGE_KEY, "</script><script>alert(1)</script>");
    expect(boot()).toBeUndefined();
  });

  it("follows the system when storage throws, without throwing itself", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(boot()).toBeUndefined();
  });

  it("holds nothing that could end the inline script early", () => {
    // "<" could open a closing script tag; U+2028 and U+2029 count as line breaks in script.
    expect(THEME_BOOT_SCRIPT).not.toContain("<");
    for (const code of [0x2028, 0x2029]) expect(THEME_BOOT_SCRIPT).not.toContain(String.fromCharCode(code));
  });
});
