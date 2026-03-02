type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

interface LogEntry {
  severity: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function log(severity: LogLevel, message: string, extra?: Record<string, unknown>): void {
  const entry: LogEntry = {
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  const output = JSON.stringify(entry);
  if (severity === "ERROR") {
    console.error(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (message: string, extra?: Record<string, unknown>) => log("DEBUG", message, extra),
  info: (message: string, extra?: Record<string, unknown>) => log("INFO", message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => log("WARN", message, extra),
  error: (message: string, extra?: Record<string, unknown>) => log("ERROR", message, extra),
};
