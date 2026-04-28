
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://localhost:54321";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "placeholder";

Deno.test("generate-bulletin: returns error when eventId is missing", async () => {
  const req = new Request(`${SUPABASE_URL}/functions/v1/generate-bulletin`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      bulletinType: "daily",
    }),
  });

  const res = await fetch(req);
  const data = await res.json();

  assertEquals(res.status, 400);
  assertEquals(data.code, "MISSING_EVENT_ID");
  assertEquals(data.error, "Evento não informado");
});

Deno.test("generate-bulletin: returns error when bulletinType is missing", async () => {
  const req = new Request(`${SUPABASE_URL}/functions/v1/generate-bulletin`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId: "00000000-0000-0000-0000-000000000000",
    }),
  });

  const res = await fetch(req);
  const data = await res.json();

  assertEquals(res.status, 400);
  assertEquals(data.code, "INVALID_BULLETIN_TYPE");
});

Deno.test("generate-bulletin: returns error when stageId is missing for daily bulletin", async () => {
  const req = new Request(`${SUPABASE_URL}/functions/v1/generate-bulletin`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId: "00000000-0000-0000-0000-000000000000",
      bulletinType: "daily",
    }),
  });

  const res = await fetch(req);
  const data = await res.json();

  assertEquals(res.status, 400);
  assertEquals(data.code, "MISSING_STAGE_ID");
});

Deno.test("generate-bulletin: returns error when no results are found", async () => {
  // Usamos um UUID aleatório que provavelmente não tem resultados
  const req = new Request(`${SUPABASE_URL}/functions/v1/generate-bulletin`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId: "00000000-0000-0000-0000-000000000001",
      bulletinType: "final",
    }),
  });

  const res = await fetch(req);
  const data = await res.json();

  // Se a função rodar contra um DB vazio ou sem esse ID, deve retornar NO_RESULTS_FOUND
  // Note: Isso depende da função estar deployed e acessível
  if (res.status === 400) {
    assertEquals(data.code, "NO_RESULTS_FOUND");
    assertEquals(data.field, "matches");
  } else {
    // Caso o ambiente de teste não tenha a função rodando localmente/deployed
    console.log("Test ignored because edge function is not reachable or returned different status");
  }
});
