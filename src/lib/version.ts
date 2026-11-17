/**
 * The version comes from package.json at build time (see vite.config.ts), so
 * the UI can never drift from the shipped package.
 */
export const APP_VERSION = __APP_VERSION__;

export const APP_VERSION_LABEL = "v" + APP_VERSION;
