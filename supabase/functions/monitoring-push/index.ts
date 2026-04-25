// Web Push 100% nativo em Deno (sem `web-push` / npm shims).
// Implementa VAPID JWT (ES256) + ECDH P-256 + AES-128-GCM (RFC 8291) com WebCrypto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// ───── Helpers base64url ─────
const enc = new TextEncoder();
function b64uToBytes(s: string): Uint8Array {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm + "=".repeat((4 - (norm.length % 4)) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64u(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.byteLength; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((a, b) => a + b.byteLength, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const a of arrs) {
    out.set(a, o);
    o += a.byteLength;
  }
  return out;
}

// ───── VAPID config ─────
const sanitize = (k: string) =>
  (k ?? "").trim().replace(/\s+/g, "").replace(/=+$/g, "")
    .replace(/\+/g, "-").replace(/\//g, "_");
const VAPID_PUBLIC = sanitize(Deno.env.get("VAPID_PUBLIC_KEY") ?? "");
const VAPID_PRIVATE = sanitize(Deno.env.get("VAPID_PRIVATE_KEY") ?? "");
const RAW_SUBJECT = (Deno.env.get("VAPID_SUBJECT") ?? "").trim();
const VAPID_SUBJECT =
  RAW_SUBJECT.startsWith("mailto:") || /^https?:\/\//.test(RAW_SUBJECT)
    ? RAW_SUBJECT
    : RAW_SUBJECT.includes("@")
    ? `mailto:${RAW_SUBJECT}`
    : "mailto:admin@jers.com.br";

// ───── Importa chave VAPID privada (raw "d" => JWK ECDSA P-256) ─────
async function importVapidPrivate(): Promise<CryptoKey> {
  const d = b64uToBytes(VAPID_PRIVATE);
  const pub = b64uToBytes(VAPID_PUBLIC); // 65 bytes (0x04 || X || Y)
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error("VAPID_PUBLIC_KEY inválida (esperado 65 bytes uncompressed)");
  }
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64u(x),
    y: bytesToB64u(y),
    d: bytesToB64u(d),
    ext: true,
  };
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
}

// ───── Gera VAPID JWT (ES256) ─────
async function vapidJwt(audience: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: VAPID_SUBJECT,
  };
  const enc64 = (o: unknown) => bytesToB64u(enc.encode(JSON.stringify(o)));
  const data = `${enc64(header)}.${enc64(payload)}`;
  const key = await importVapidPrivate();
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      enc.encode(data),
    ),
  );
  // WebCrypto já retorna IEEE P1363 (R||S) — formato esperado por JOSE ES256
  return `${data}.${bytesToB64u(sig)}`;
}

// ───── HKDF (RFC 5869) ─────
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    ikm as BufferSource,
    { name: "HKDF" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

// ───── Criptografa payload conforme RFC 8291 (aes128gcm) ─────
async function encryptPayload(
  payload: Uint8Array,
  uaPubBytes: Uint8Array, // 65 bytes uncompressed P-256
  authSecret: Uint8Array, // 16 bytes
): Promise<{ body: Uint8Array; serverPubBytes: Uint8Array; salt: Uint8Array }> {
  // 1. Chave efêmera do servidor
  const ephem = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephem.publicKey),
  ); // 65 bytes

  // 2. Importa chave pública do UA
  const uaPubKey = await crypto.subtle.importKey(
    "raw",
    uaPubBytes as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    true,
    [],
  );

  // 3. ECDH shared secret
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: uaPubKey },
      ephem.privateKey,
      256,
    ),
  );

  // 4. PRK_key = HKDF(authSecret, ecdh, "WebPush: info" || 0x00 || ua_pub || server_pub, 32)
  const keyInfo = concat(
    enc.encode("WebPush: info\0"),
    uaPubBytes,
    serverPubRaw,
  );
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);

  // 5. salt aleatório (16 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 6. CEK e nonce
  const cek = await hkdf(
    salt,
    ikm,
    concat(enc.encode("Content-Encoding: aes128gcm\0")),
    16,
  );
  const nonce = await hkdf(
    salt,
    ikm,
    concat(enc.encode("Content-Encoding: nonce\0")),
    12,
  );

  // 7. Padding: 0x02 + zeros (last record)
  const padded = concat(payload, new Uint8Array([0x02]));

  // 8. AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    cek as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      aesKey,
      padded.buffer.slice(padded.byteOffset, padded.byteOffset + padded.byteLength),
    ),
  );

  // 9. Header bloco aes128gcm: salt(16) || rs(4) || idlen(1) || keyid(idlen)
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  const header = concat(
    salt,
    rs,
    new Uint8Array([serverPubRaw.length]),
    serverPubRaw,
  );

  return { body: concat(header, ciphertext), serverPubBytes: serverPubRaw, salt };
}

// ───── Envio ─────
interface PushSub {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendPush(
  sub: PushSub,
  payloadJson: string,
): Promise<{ status: number; body?: string }> {
  const url = new URL(sub.endpoint);
  const aud = `${url.protocol}//${url.host}`;
  const jwt = await vapidJwt(aud);

  const uaPub = b64uToBytes(sub.p256dh);
  const authSecret = b64uToBytes(sub.auth);
  if (uaPub.length !== 65) {
    throw new Error(`p256dh inválido: ${uaPub.length} bytes`);
  }
  if (authSecret.length !== 16) {
    throw new Error(`auth inválido: ${authSecret.length} bytes`);
  }

  const { body } = await encryptPayload(
    enc.encode(payloadJson),
    uaPub,
    authSecret,
  );

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "60",
      "Authorization": `vapid t=${jwt}, k=${VAPID_PUBLIC}`,
    },
    body,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { status: res.status, body: txt };
  }
  await res.body?.cancel().catch(() => {});
  return { status: res.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(
        JSON.stringify({ error: "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY ausentes" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Auth check: require Bearer token. Accept either the SERVICE_ROLE key
    // (used by internal callers like monitoring-collect) or an authenticated
    // super_admin user JWT.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const token = authHeader.replace("Bearer ", "").trim();
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    if (token !== SERVICE_ROLE) {
      const { data: userData, error: userErr } = await supabase.auth.getUser(token);
      if (userErr || !userData?.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      const isSuper = (roles ?? []).some((r) => r.role === "super_admin");
      if (!isSuper) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const payload = await req.json().catch(() => ({}));
    const { title = "JER Monitor", body = "Teste de notificação", url, userIds } = payload;

    let query = supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, user_id")
      .eq("active", true);

    if (userIds && Array.isArray(userIds) && userIds.length > 0) {
      query = query.in("user_id", userIds);
    } else {
      const { data: sa } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      const ids = (sa ?? []).map((r) => r.user_id);
      if (ids.length === 0) {
        return new Response(
          JSON.stringify({ ok: true, sent: 0, failed: 0, reason: "no super_admin" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      query = query.in("user_id", ids);
    }

    const { data: subs, error } = await query;
    if (error) throw error;

    const message = JSON.stringify({ title, body, url: url ?? "/super/monitor" });
    const details: Array<Record<string, unknown>> = [];
    let sent = 0;
    let failed = 0;

    await Promise.all(
      (subs ?? []).map(async (sub) => {
        try {
          const r = await sendPush(
            { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
            message,
          );
          if (r.status >= 200 && r.status < 300) {
            sent++;
            await supabase
              .from("push_subscriptions")
              .update({ last_used_at: new Date().toISOString() })
              .eq("id", sub.id);
          } else if (r.status === 404 || r.status === 410) {
            failed++;
            await supabase
              .from("push_subscriptions")
              .update({ active: false })
              .eq("id", sub.id);
            details.push({ id: sub.id, status: r.status, reason: "gone", body: r.body });
          } else {
            failed++;
            details.push({ id: sub.id, status: r.status, body: r.body });
          }
        } catch (err) {
          failed++;
          details.push({ id: sub.id, error: String((err as Error).message ?? err) });
          console.error("push fail", sub.endpoint, err);
        }
      }),
    );

    return new Response(JSON.stringify({ ok: true, sent, failed, details }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("monitoring-push error", e);
    return new Response(JSON.stringify({ error: String((e as Error).message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
