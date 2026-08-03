export type AlphaCapabilities = {
  runStart: boolean;
  githubConnect: boolean;
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
): AlphaCapabilities {
  const allowlisted = Boolean(userId && parseAllowedUserIds(allowedUserIds).has(userId));

  return {
    runStart: allowlisted,
    githubConnect: false,
    delivery: false,
    billing: false,
  };
}
