const isProd = import.meta.env.PROD;

export const logger = {
  log: (...args: any[]) => {
    if (!isProd) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (!isProd) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // Errors are usually logged even in production, or sent to a monitoring service
    console.error(...args);
  },
  info: (...args: any[]) => {
    if (!isProd) {
      console.info(...args);
    }
  },
  debug: (...args: any[]) => {
    if (!isProd) {
      console.debug(...args);
    }
  }
};
