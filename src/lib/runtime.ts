/**
 * Runtime detection helpers for Capacitor / Web environments.
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform: () => boolean;
      getPlatform: () => string;
    };
  }
}

export function isNativeApp(): boolean {
  return !!window.Capacitor?.isNativePlatform();
}

export function isIOS(): boolean {
  if (isNativeApp()) return window.Capacitor!.getPlatform() === "ios";
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (isNativeApp()) return window.Capacitor!.getPlatform() === "android";
  return /Android/.test(navigator.userAgent);
}
