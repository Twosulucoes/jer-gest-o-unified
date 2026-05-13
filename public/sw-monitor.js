// Service Worker dedicado ao Monitor + Alertas (push notifications)
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// ─── Mapeamento de tipo → ícone e rota de destino ────────
const TYPE_CONFIG = {
  janela_abrindo:   { icon: "/pwa/icon-192.png", badge: "/pwa/icon-72.png", path: "/pwa/alimentacao/janelas" },
  janela_encerrada: { icon: "/pwa/icon-192.png", badge: "/pwa/icon-72.png", path: "/pwa/alimentacao/janelas" },
  operador_inativo: { icon: "/pwa/icon-192.png", badge: "/pwa/icon-72.png", path: "/admin/alertas" },
  sync_errors:      { icon: "/pwa/icon-192.png", badge: "/pwa/icon-72.png", path: "/pwa" },
  sistema_offline:  { icon: "/pwa/icon-192.png", badge: "/pwa/icon-72.png", path: "/pwa" },
  duplicidade:      { icon: "/pwa/icon-192.png", badge: "/pwa/icon-72.png", path: "/pwa/alimentacao" },
};

const DEFAULT_CONFIG = {
  icon: "/pwa/icon-192.png",
  badge: "/pwa/icon-72.png",
  path: "/pwa",
};

self.addEventListener("push", (event) => {
  let data = { title: "JER", body: "Nova notificação", tag: "jer-monitor", url: null };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {
    if (event.data) data.body = event.data.text();
  }

  const cfg = TYPE_CONFIG[data.tag] ?? DEFAULT_CONFIG;
  const targetUrl = data.url ?? cfg.path;

  const options = {
    body: data.body,
    icon: cfg.icon,
    badge: cfg.badge,
    data: { url: targetUrl },
    vibrate: [100, 50, 100],
    tag: data.tag || "jer-monitor",
    // Não agrupa notificações do mesmo tipo — cada uma é exibida
    renotify: true,
    requireInteraction: ["operador_inativo", "sync_errors", "sistema_offline"].includes(data.tag),
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/pwa";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if ("focus" in client) {
            client.navigate(targetUrl).catch(() => {});
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
      }),
  );
});
