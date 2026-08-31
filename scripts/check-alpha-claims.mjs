import { readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function isPublicSurfacePath(path) {
  const normalized = path.replaceAll("\\", "/");
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(normalized)) return false;
  if (normalized === "README.md") return true;
  if (normalized.startsWith("src/components/") && normalized.endsWith(".tsx")) return true;
  return normalized.startsWith("src/app/") && /\.[cm]?[jt]sx?$/.test(normalized);
}

function walkFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`;
    return entry.isDirectory() ? walkFiles(path) : [path];
  });
}

function discoverPublicSurfaces() {
  return ["README.md", ...walkFiles("src/app"), ...walkFiles("src/components")]
    .filter(isPublicSurfacePath)
    .sort();
}

const bannedClaims = [
  ["paid price", /\$29/i],
  ["private repository support", /private repositories/i],
  ["verified-run availability", /start a verified run/i],
  ["whole-task token savings", /fewer total tokens per verified task/i],
  ["verified token savings", /verified token savings/i],
  ["automatic pull-request delivery", /approve\s*&\s*open github pr/i],
  ["published npm package", /npx(?:\s+-y)?\s+locus-context/i],
  ["enterprise identity support", /sso\s*\/\s*saml/i],
  ["service-level guarantee", /sla guarantee/i],
  ["unsupported benchmark count", /120 api calls/i],
  ["unsupported percentage savings", /(?:\d+|\$\{[^}]+\}|\{[^}]+\})%\s+saved/i],
  ["unsupported percentage token reduction", /(?:\d+|\$\{[^}]+\}|\{[^}]+\})%\s+fewer\s+tokens/i],
  ["verified delivery", /verified delivery/i],
  ["unreleased upgrade", /upgrade\s+(?:for|to).*?(?:private repo|team|pro)/i],
  ["unsupported verified-run quota", /(?:ten|10)\s+verified\s+agent\s+runs/i],
];

export function findBannedAlphaClaims(sources) {
  return sources.flatMap(({ path, content }) =>
    bannedClaims.flatMap(([label, pattern]) =>
      pattern.test(content) ? [`${path}: ${label}`] : [],
    ),
  );
}

function main() {
  const publicSurfaces = discoverPublicSurfaces();
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
