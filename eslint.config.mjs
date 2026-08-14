import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/app/.well-known/workflow/**",
    // Written by `supabase start`, not by this project. Gitignored, but eslint
    // ignores are configured separately and it lints the generated edge-runtime
    // entrypoint otherwise.
    "supabase/.temp/**",
  ]),
]);

export default eslintConfig;
