/**
 * Logger utility that respects NODE_ENV for log output
 * In production, only errors and warnings are logged
 * In development, all logs are shown
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LoggerConfig {
  level: LogLevel;
  isDevelopment: boolean;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LoggerConfig;

  constructor() {
    const isDevelopment = process.env.NODE_ENV !== "production";
    this.config = {
      level: isDevelopment ? "debug" : "warn",
      isDevelopment,
    };
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  /**
   * Debug logs - only in development
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog("debug")) {
      console.log(this.formatMessage("debug", message), ...args);
    }
  }

  /**
   * Info logs - only in development
   */
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog("info")) {
      console.log(this.formatMessage("info", message), ...args);
    }
  }

  /**
   * Warning logs - always shown
   */
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog("warn")) {
      console.warn(this.formatMessage("warn", message), ...args);
    }
  }

  /**
   * Error logs - always shown
   */
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog("error")) {
      console.error(this.formatMessage("error", message), ...args);
    }
  }

  /**
   * Startup banner - always shown (special case for server startup)
   */
  banner(lines: string[]): void {
    if (this.config.isDevelopment) {
      lines.forEach((line) => console.log(line));
    }
  }

  /**
   * Check if running in development mode
   */
  isDevelopment(): boolean {
    return this.config.isDevelopment;
  }
}

export const logger = new Logger();
