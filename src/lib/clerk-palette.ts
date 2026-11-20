/**
 * Clerk derives its shades from literal colours, so its widgets get the token
 * values for the theme on screen rather than CSS variables. These must match
 * globals.css; src/app/design-tokens.test.ts holds them to it.
 */
export const CLERK_PALETTE = {
  light: {
    colorPrimary: "#161513",
    colorBackground: "#fbfaf8",
    colorInputBackground: "#f3f2ee",
    colorInputText: "#161513",
    colorText: "#161513",
    colorTextSecondary: "#44423d",
    colorTextOnPrimaryBackground: "#f3f2ee",
    colorNeutral: "#161513",
    colorDanger: "#b42346",
    colorSuccess: "#2c7a4b",
  },
  dark: {
    colorPrimary: "#eceae4",
    colorBackground: "#171716",
    colorInputBackground: "#0f0f0e",
    colorInputText: "#eceae4",
    colorText: "#eceae4",
    colorTextSecondary: "#b8b5ad",
    colorTextOnPrimaryBackground: "#0f0f0e",
    colorNeutral: "#eceae4",
    colorDanger: "#ff7a8a",
    colorSuccess: "#5dc48a",
  },
} as const;
