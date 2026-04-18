import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BEh7XcFqhnTF01NHAejxw2MJyly8BvSSp5mok_2wy7sCXtWW3XBrnMrIY5udU7b1SOlqfQQjT8X_NM6SRoT7xWE";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null) {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.permission;
}

export async function registerMonitorSW() {
  if (!isPushSupported()) throw new Error("Push não suportado neste navegador");
  return navigator.serviceWorker.register("/sw-monitor.js", { scope: "/" });
}

export async function subscribeToPush() {
  if (!isPushSupported()) throw new Error("Push não suportado");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Permissão negada");

  const reg = await registerMonitorSW();
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh")),
    auth: json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth")),
    user_agent: navigator.userAgent,
    active: true,
  }, { onConflict: "endpoint" });

  return sub;
}

export async function unsubscribeFromPush() {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase.from("push_subscriptions").update({ active: false }).eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  }
}
