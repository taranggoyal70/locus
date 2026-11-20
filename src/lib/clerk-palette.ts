/**
 * Clerk derives its shades from literal colours, so its widgets get the token
 * values for the theme on screen rather than CSS variables. These must match
 * globals.css; src/app/design-tokens.test.ts holds them to it.
 */
export const CLERK_PALETTE = {
  light: {
    colorPrimary: "#14233b",
    colorBackground: "#fbfaf6",
    colorInputBackground: "#f3f1ea",
    colorInputText: "#14233b",
    colorText: "#14233b",
    colorTextSecondary: "#3e4f63",
    colorTextOnPrimaryBackground: "#f3f1ea",
    colorNeutral: "#14233b",
    colorDanger: "#b03a2e",
    colorSuccess: "#087864",
  },
  dark: {
    colorPrimary: "#ece8df",
    colorBackground: "#142033",
    colorInputBackground: "#0d1420",
    colorInputText: "#ece8df",
    colorText: "#ece8df",
    colorTextSecondary: "#b8c2cd",
    colorTextOnPrimaryBackground: "#0d1420",
    colorNeutral: "#ece8df",
    colorDanger: "#f08f80",
    colorSuccess: "#45c4a3",
  },
} as const;
