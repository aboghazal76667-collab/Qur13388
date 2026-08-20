/**
 * Technical detail goes here, never to the screen.
 *
 * In development this prints. In production it is the seam where a crash
 * reporter would be attached — deliberately behind an interface so we are not
 * married to a vendor.
 */
export interface LogSink {
  debug(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown>): void;
}

const consoleSink: LogSink = {
  debug(message, context) {
    if (__DEV__) console.log(`[pm] ${message}`, context ?? '');
  },
  warn(message, context) {
    console.warn(`[pm] ${message}`, context ?? '');
  },
  error(message, context) {
    console.error(`[pm] ${message}`, context ?? '');
  },
};

let sink: LogSink = consoleSink;

export function setLogSink(next: LogSink): void {
  sink = next;
}

export const log: LogSink = {
  debug: (message, context) => sink.debug(message, context),
  warn: (message, context) => sink.warn(message, context),
  error: (message, context) => sink.error(message, context),
};
