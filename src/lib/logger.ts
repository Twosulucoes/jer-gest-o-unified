import { reportError } from "@/lib/monitoring/errorReporter";

const isProd = import.meta.env.PROD;

export const logger = {
  log: (...args: unknown[]) => {
    if (!isProd) {
      console.log(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (!isProd) {
      console.warn(...args);
    }
  },
  error: (message: string, context?: unknown) => {
    console.error(message, context);
    
    // In production, we report every call to logger.error
    reportError({
      message: `[Logger] ${message}`,
      severity: "error",
      context: context ? { details: context } : undefined
    });
  },
  critical: (message: string, context?: unknown) => {
    console.error(`[CRITICAL] ${message}`, context);
    
    reportError({
      message: `[CRITICAL] ${message}`,
      severity: "critical",
      context: context ? { details: context } : undefined
    });
  },
  info: (...args: unknown[]) => {
    if (!isProd) {
      console.info(...args);
    }
  },
  debug: (...args: unknown[]) => {
    if (!isProd) {
      console.debug(...args);
    }
  }
};
