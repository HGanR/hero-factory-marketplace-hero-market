/**
 * Logger Utility Class
 *
 * Provides structured logging for XRPL services with different log levels.
 */

export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  data?: unknown;
  error?: unknown;
}

/**
 * Logger class for structured logging
 */
export class Logger {
  private service: string;
  private minLevel: LogLevel = LogLevel.INFO;

  constructor(service: string, minLevel: LogLevel = LogLevel.INFO) {
    this.service = service;
    this.minLevel = minLevel;
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, error?: unknown): void {
    this.log(LogLevel.WARN, message, undefined, error);
  }

  error(message: string, error?: unknown): void {
    this.log(LogLevel.ERROR, message, undefined, error);
  }

  private log(level: LogLevel, message: string, data?: unknown, error?: unknown): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
      data,
      error: error ? this.serializeError(error) : undefined,
    };

    const logFn = this.getConsoleFn(level);
    logFn(JSON.stringify(entry, null, 2));
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const minIndex = levels.indexOf(this.minLevel);
    const currentIndex = levels.indexOf(level);
    return currentIndex >= minIndex;
  }

  private getConsoleFn(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
        return console.error;
      default:
        return console.log;
    }
  }

  private serializeError(error: unknown): unknown {
    if (error instanceof Error) {
      return { name: error.name, message: error.message, stack: error.stack };
    }
    return error;
  }
}

export default Logger;














