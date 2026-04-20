// Diagnóstico de chaves VAPID — retorna metadados (sem expor segredos).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function b64uToBytes(s: string): Uint8Array {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm + "=".repeat((4 - (norm.length % 4)) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
Deno.serve((_req) => {
  const pubRaw = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const privRaw = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const subj = Deno.env.get("VAPID_SUBJECT") ?? "";
  const sanitize = (k: string) =>
    k.trim().replace(/\s+/g, "").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const pub = sanitize(pubRaw);
  const priv = sanitize(privRaw);
  const result: Record<string, unknown> = {
    pub_raw_len: pubRaw.length,
    priv_raw_len: privRaw.length,
    pub_san_len: pub.length,
    priv_san_len: priv.length,
    pub_has_whitespace: /\s/.test(pubRaw),
    priv_has_whitespace: /\s/.test(privRaw),
    subject: subj,
  };
  try {
    const pb = b64uToBytes(pub);
    result.pub_bytes_len = pb.length;
    result.pub_first_byte = pb[0];
  } catch (e) {
    result.pub_decode_error = String((e as Error).message);
  }
  try {
    const pb = b64uToBytes(priv);
    result.priv_bytes_len = pb.length;
  } catch (e) {
    result.priv_decode_error = String((e as Error).message);
  }
  return new Response(JSON.stringify(result, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
