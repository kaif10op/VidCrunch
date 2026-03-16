/** Production-safe logger that suppresses debug output in production */

const isProd = import.meta.env.PROD;

export const logger = {
  error(message: string, ...args: unknown[]) {
    if (!isProd) {
      console.error(`[YouLearn] ${message}`, ...args);
    }
    // In production, you'd send to Sentry/LogRocket/etc.
  },

  warn(message: string, ...args: unknown[]) {
    if (!isProd) {
      console.warn(`[YouLearn] ${message}`, ...args);
    }
  },

  info(message: string, ...args: unknown[]) {
    if (!isProd) {
      console.info(`[YouLearn] ${message}`, ...args);
    }
  },

  debug(message: string, ...args: unknown[]) {
    if (!isProd) {
      console.debug(`[YouLearn] ${message}`, ...args);
    }
  },
} as const;
