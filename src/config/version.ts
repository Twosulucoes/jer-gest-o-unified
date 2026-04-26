// Use the commit hash injected by Vite if available, otherwise fallback
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.1';
export const VERSION_KEY = 'app_current_version';
