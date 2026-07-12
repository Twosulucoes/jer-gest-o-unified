// Edge Function: process-alerts
// Chama process_alerts() para detectar condições de alerta,
// depois envia push notifications para assinaturas ativas.
// Pode ser invocada via cron externo (ex: Vercel cron) ou
// manualmente pelo admin. Usa as mesmas chaves VAPID e lógica
// de envio do monitoring-push.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC   = sanitizeKey(Deno.env.get("VAPID_PUBLIC_KEY")  ?? "");
const VAPID_PRIVATE  = sanitizeKey(Deno.env.get("VAPID_PRIVATE_KEY") ?? "");
const RAW_SUBJECT    = (Deno.env.get("VAPID_SUBJECT") ?? "").trim();
const VAPID_SUBJECT  = RAW_SUBJECT.startsWith("mailto:") || /^https?:\/\//.test(RAW_SUBJECT)
  ? RAW_SUBJECT
  : RAW_SUBJECT.includes("@") ? `mailto:${RAW_SUBJECT}` : "mailto:admin@jers.com.br";

// ─── Base64url helpers ────────────────────────────────────
function sanitizeKey(k: string) {
  return k.trim().replace(/\s+/g, "").replace(/=+$/, "")
           .replace(/\+/g, "-").replace(/\//g, "_");
}
const enc = new TextEncoder();

function b64uToBytes(s: string): Uint8Array {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad  = norm + "=".repeat((4 - (norm.length % 4)) % 4);
  const bin  = atob(pad);
  const out  = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64u(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.byteLength; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((a, b) => a + b.byteLength, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of arrs) { out.set(a, o); o += a.byteLength; }
  return out;
}

// ─── VAPID JWT ────────────────────────────────────────────
async function makeVapidJwt(audience: string): Promise<string> {
  const header  = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: VAPID_SUBJECT };
  const unsigned = `${bytesToB64u(enc.encode(JSON.stringify(header)))}.${bytesToB64u(enc.encode(JSON.stringify(payload)))}`;
  const privKey  = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", d: VAPID_PRIVATE, x: "", y: "", ext: true },
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"],
  );
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" }, privKey, enc.encode(unsigned),
  ));
  return `${unsigned}.${bytesToB64u(sig)}`;
}

// ─── Web Push (AES-128-GCM + VAPID) ──────────────────────
// HKDF (RFC 5869) — o salt é parâmetro: cada etapa da RFC 8291 usa um salt diferente.
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const keyMat = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt, info },
    keyMat, length * 8,
  ));
}

// Web Push conforme RFC 8291 (aes128gcm) — mesma implementação de monitoring-push.
async function sendPush(
  sub: { endpoint: string; p256dh: string; auth: string },
  messageJson: string,
): Promise<{ status: number; body: string }> {
  const url     = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt      = await makeVapidJwt(audience);
  const clientPub  = b64uToBytes(sub.p256dh);   // 65 bytes (P-256 uncompressed)
  const clientAuth = b64uToBytes(sub.auth);     // 16 bytes

  const serverKey = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKey.publicKey));

  const sharedBits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "ECDH", public: await crypto.subtle.importKey("raw", clientPub, { name: "ECDH", namedCurve: "P-256" }, false, []) },
    serverKey.privateKey, 256,
  ));

  // PRK_key = HKDF(salt=auth, ikm=ecdh, info="WebPush: info\0" || ua_pub || server_pub, 32)
  const keyInfo = concat(enc.encode("WebPush: info\0"), clientPub, serverPubRaw);
  const ikm = await hkdf(clientAuth, sharedBits, keyInfo, 32);

  // CEK e nonce derivam do salt aleatório (que também vai no cabeçalho do corpo).
  const salt     = crypto.getRandomValues(new Uint8Array(16));
  const cekKey   = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonceRaw = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cekKey, "AES-GCM", false, ["encrypt"]);
  const padded = concat(enc.encode(messageJson), new Uint8Array([0x02])); // padding delimiter (último registro)
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonceRaw }, aesKey, padded));

  // Corpo aes128gcm: salt(16) || rs(4=4096) || idlen(1) || keyid(server_pub) || ciphertext
  const header = concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([serverPubRaw.length]), serverPubRaw);
  const body = concat(header, ciphertext);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Authorization": `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
    },
    body,
  });

  return { status: res.status, body: await res.text().catch(() => "") };
}

// ─── Handler principal ────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const db = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. Rodar detecção de alertas via SQL (insere em notifications)
    const { data: alertResult, error: alertErr } = await db.rpc("process_alerts");
    if (alertErr) console.error("process_alerts error:", alertErr.message);

    // 2. Buscar notificações pendentes de push
    const { data: pending, error: pendErr } = await db
      .from("notifications")
      .select("id, user_id, type, title, body, data")
      .eq("push_sent", false)
      .order("created_at", { ascending: false })
      .limit(100);

    if (pendErr) throw pendErr;
    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, process_alerts: alertResult, pushed: 0, skipped: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Agrupar por user_id para buscar assinaturas em lote
    const userIds = [...new Set(pending.map((n: any) => n.user_id))];
    const { data: subs } = await db
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth")
      .in("user_id", userIds)
      .eq("active", true);

    const subsByUser = new Map<string, typeof subs>();
    for (const s of subs ?? []) {
      const list = subsByUser.get(s.user_id) ?? [];
      list.push(s);
      subsByUser.set(s.user_id, list);
    }

    let pushed = 0;
    let failed = 0;
    const sentNotifIds: string[] = [];

    // 4. Enviar push para cada notificação
    await Promise.all(
      pending.map(async (notif: any) => {
        const userSubs = subsByUser.get(notif.user_id) ?? [];
        const message = JSON.stringify({
          title: notif.title,
          body:  notif.body,
          tag:   notif.type,
          url:   (notif.data as any)?.url ?? "/pwa",
        });

        let anySent = false;
        await Promise.all(
          userSubs.map(async (s: any) => {
            try {
              const r = await sendPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, message);
              if (r.status >= 200 && r.status < 300) {
                pushed++;
                anySent = true;
              } else if (r.status === 404 || r.status === 410) {
                await db.from("push_subscriptions").update({ active: false }).eq("id", s.id);
                failed++;
              } else {
                failed++;
              }
            } catch {
              failed++;
            }
          }),
        );

        // Marca push_sent independentemente (evita retry infinito)
        sentNotifIds.push(notif.id);
      }),
    );

    if (sentNotifIds.length > 0) {
      await db.from("notifications")
        .update({ push_sent: true })
        .in("id", sentNotifIds);
    }

    return new Response(
      JSON.stringify({ ok: true, process_alerts: alertResult, pushed, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("process-alerts error:", e);
    return new Response(
      JSON.stringify({ error: String((e as Error).message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
