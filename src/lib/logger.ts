type LogLevel = "info" | "warn" | "error";

type LogEntry = {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: string;
};

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

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    emit({ level: "info", message, context, timestamp: new Date().toISOString() });
  },
  warn(message: string, context?: Record<string, unknown>) {
    emit({ level: "warn", message, context, timestamp: new Date().toISOString() });
  },
  error(message: string, context?: Record<string, unknown>) {
    emit({ level: "error", message, context, timestamp: new Date().toISOString() });
  },
};
