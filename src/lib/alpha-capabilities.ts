export type AlphaCapabilities = {
  runStart: boolean;
  githubConnect: boolean;
  privateRepoRead: boolean;
  teams: boolean;
  savingsClaims: boolean;
  delivery: boolean;
  billing: boolean;
};

function parseAllowedUserIds(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

export function alphaCapabilitiesForUser(
  userId: string | null,
  allowedUserIds = process.env.ALPHA_ALLOWED_USER_IDS,
  publicBetaEnabled = process.env.LOCUS_PUBLIC_BETA_ENABLED,
): AlphaCapabilities {
  const allowlisted = Boolean(userId && parseAllowedUserIds(allowedUserIds).has(userId));
  const publicBeta = publicBetaEnabled?.trim().toLowerCase() === "true";

  return {
    runStart: Boolean(userId && (allowlisted || publicBeta)),
    githubConnect: false,
    privateRepoRead: false,
    teams: false,
    savingsClaims: false,
    delivery: false,
    billing: false,
  };
}
