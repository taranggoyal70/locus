import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const publicSurfaces = [
  "README.md",
  "src/app/layout.tsx",
  "src/app/opengraph-image.tsx",
  "src/app/pricing/page.tsx",
  "src/app/docs/page.tsx",
  "src/app/privacy/page.tsx",
  "src/app/terms/page.tsx",
  "src/app/projects/page.tsx",
  "src/components/LandingPage.tsx",
  "src/components/MarketingShell.tsx",
  "src/components/AuthShell.tsx",
  "src/components/WaitlistForm.tsx",
  "src/components/LocusApp.tsx",
  "src/components/AgentRunPanel.tsx",
  "src/components/AgentRunsList.tsx",
  "src/components/AlphaSettingsNotice.tsx",
  "src/components/OnboardingBanner.tsx",
];

const bannedClaims = [
  ["paid price", /\$29/i],
  ["private repository support", /private repositories/i],
  ["public-beta availability", /public beta/i],
  ["verified-run availability", /start a verified run/i],
  ["whole-task token savings", /fewer total tokens per verified task/i],
  ["verified token savings", /verified token savings/i],
  ["automatic pull-request delivery", /approve\s*&\s*open github pr/i],
  ["published npm package", /npx(?:\s+-y)?\s+locus-context/i],
  ["enterprise identity support", /sso\s*\/\s*saml/i],
  ["service-level guarantee", /sla guarantee/i],
  ["unsupported benchmark count", /120 api calls/i],
];

export function findBannedAlphaClaims(sources) {
  return sources.flatMap(({ path, content }) =>
    bannedClaims.flatMap(([label, pattern]) =>
      pattern.test(content) ? [`${path}: ${label}`] : [],
    ),
  );
}

function main() {
  const sources = publicSurfaces.map((path) => ({
    path,
    content: readFileSync(path, "utf8"),
  }));
  const findings = findBannedAlphaClaims(sources);

  if (findings.length > 0) {
    console.error("Unsupported controlled-alpha claims found:");
    findings.forEach((finding) => console.error(`- ${finding}`));
    process.exitCode = 1;
    return;
  }

  console.log(`Checked ${sources.length} public surfaces; no banned claims found.`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
