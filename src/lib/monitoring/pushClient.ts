import { supabase } from "@/integrations/supabase/client";

const VAPID_PUBLIC_KEY = "BO7tm7tZFigzB6q6jfXgSIWJMH_zWXEk5wHmnSXTSDRFgPedKwDj_V6serUrVT1RCLEzG2d4gcGOOrW9jNAqogw";

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

  const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

  // Se já existe uma assinatura, valida se foi feita com a mesma chave VAPID.
  // Caso a chave do servidor tenha mudado, recriar a assinatura é obrigatório.
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const existingKey = sub.options?.applicationServerKey
      ? new Uint8Array(sub.options.applicationServerKey as ArrayBuffer)
      : null;
    const sameKey =
      existingKey &&
      existingKey.length === appServerKey.length &&
      existingKey.every((b, i) => b === appServerKey[i]);
    if (!sameKey) {
      try {
        await supabase
          .from("push_subscriptions")
          .update({ active: false })
          .eq("endpoint", sub.endpoint);
      } catch { /* ignore */ }
      await sub.unsubscribe();
      sub = null;
    }
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: appServerKey,
    });
  }

  const json = sub.toJSON();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Usuário não autenticado");

  const { error } = await supabase.from("push_subscriptions").upsert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh")),
    auth: json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth")),
    user_agent: navigator.userAgent,
    active: true,
  }, { onConflict: "endpoint" });
  if (error) throw error;

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
