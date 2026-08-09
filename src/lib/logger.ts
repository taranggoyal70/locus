type LogLevel = "info" | "warn" | "error";

type LogEntry = {
  level: LogLevel;
  event: string;
  correlationId: string | null;
  context?: Record<string, unknown>;
  timestamp: string;
};

const SENSITIVE_KEY = /authorization|cookie|password|secret|token|api[_-]?key|access[_-]?key/i;

// R15: redacting by field name only protects credentials that arrive under a
// name we thought of. It does nothing for the common case: a secret embedded
// in a value under an innocent key, such as an error message that quotes the
// failing request, a stack trace, or a URL carrying a token. Those reach the
// log in full.
//
// So values are scrubbed by shape as well as by key. These patterns match
// credential formats with distinctive, self-identifying prefixes, which keeps
// false positives low; deliberately absent is any "long random-looking string"
// rule, which would redact commit SHAs, run ids, and file hashes and make the
// logs useless for the incident response they exist to support.
const SECRET_VALUE_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  // Keep the scheme so the log still shows that a credential was presented.
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, replacement: "Bearer [REDACTED]" },
  { pattern: /\bBasic\s+[A-Za-z0-9+/=]{8,}/gi, replacement: "Basic [REDACTED]" },
  // Locus API keys.
  { pattern: /\blk_[A-Za-z0-9_-]{8,}/g, replacement: "[REDACTED]" },
  // Stripe keys and webhook secrets.
  { pattern: /\b[srp]k_(?:live|test)_[A-Za-z0-9]{8,}/g, replacement: "[REDACTED]" },
  { pattern: /\bwhsec_[A-Za-z0-9]{8,}/g, replacement: "[REDACTED]" },
  // GitHub personal access, OAuth, and installation tokens.
  { pattern: /\bgh[pousr]_[A-Za-z0-9]{16,}/g, replacement: "[REDACTED]" },
  { pattern: /\bgithub_pat_[A-Za-z0-9_]{16,}/g, replacement: "[REDACTED]" },
  // Supabase service and publishable keys.
  { pattern: /\bsb[ps]_[A-Za-z0-9_-]{16,}/g, replacement: "[REDACTED]" },
  // AWS access key ids.
  { pattern: /\bAKIA[0-9A-Z]{16}\b/g, replacement: "[REDACTED]" },
  // Any JWT, which covers Supabase anon/service keys and Clerk sessions.
  {
    pattern: /\beyJ[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}\.[A-Za-z0-9_-]{6,}/g,
    replacement: "[REDACTED]",
  },
];

export function redactSecrets(value: string): string {
  let output = value;
  for (const { pattern, replacement } of SECRET_VALUE_PATTERNS) {
    // The patterns are global, so reset lastIndex rather than relying on the
    // shared regex state across calls.
    pattern.lastIndex = 0;
    output = output.replace(pattern, replacement);
  }
  return output;
}

function sanitizeValue(value: unknown, key: string, depth: number): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (depth > 4) return "[TRUNCATED]";
  // Redact before truncating: a secret straddling the 1,000 character boundary
  // would otherwise survive as a usable prefix.
  if (typeof value === "string") return redactSecrets(value).slice(0, 1_000);
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, "item", depth + 1));
  }
  if (typeof value === "object" && value) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 30)
        .map(([childKey, childValue]) => [
          childKey,
          sanitizeValue(childValue, childKey, depth + 1),
        ]),
    );
  }
  // Errors and other objects stringify into messages that routinely quote the
  // request that failed, so this path needs the same scrubbing.
  return redactSecrets(String(value)).slice(0, 1_000);
}

export function createLogEntry(
  level: LogLevel,
  event: string,
  options: { correlationId?: string | null; context?: Record<string, unknown> } = {},
): LogEntry {
  const correlationId = options.correlationId?.trim();
  const safeCorrelationId = correlationId && correlationId.length <= 160
    ? correlationId
    : null;
  const safeContext = options.context
    ? sanitizeValue(options.context, "context", 0) as Record<string, unknown>
    : undefined;
  return {
    level,
    event: event.replace(/[^a-z0-9._-]/gi, "_").slice(0, 120),
    correlationId: safeCorrelationId,
    ...(safeContext ? { context: safeContext } : {}),
    timestamp: new Date().toISOString(),
  };
}

function emit(entry: LogEntry) {
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(line);
  } else if (entry.level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

function write(
  level: LogLevel,
  event: string,
  context?: Record<string, unknown>,
  correlationId?: string | null,
) {
  emit(createLogEntry(level, event, { context, correlationId }));
}

export const logger = {
  info(event: string, context?: Record<string, unknown>, correlationId?: string | null) {
    write("info", event, context, correlationId);
  },
  warn(event: string, context?: Record<string, unknown>, correlationId?: string | null) {
    write("warn", event, context, correlationId);
  },
  error(event: string, context?: Record<string, unknown>, correlationId?: string | null) {
    write("error", event, context, correlationId);
  },
};
