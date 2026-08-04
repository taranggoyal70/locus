type LogLevel = "info" | "warn" | "error";

type LogEntry = {
  level: LogLevel;
  event: string;
  correlationId: string | null;
  context?: Record<string, unknown>;
  timestamp: string;
};

const SENSITIVE_KEY = /authorization|cookie|password|secret|token|api[_-]?key|access[_-]?key/i;

function sanitizeValue(value: unknown, key: string, depth: number): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (depth > 4) return "[TRUNCATED]";
  if (typeof value === "string") return value.slice(0, 1_000);
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
  return String(value).slice(0, 1_000);
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
