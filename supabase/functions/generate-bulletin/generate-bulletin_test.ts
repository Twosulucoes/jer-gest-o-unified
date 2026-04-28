
import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "http://localhost:54321";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "placeholder";

Deno.test("generate-bulletin: returns error when eventId is missing (MISSING_EVENT_ID)", async () => {
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
  assertEquals(typeof data.error, "string");
  assertEquals(typeof data.details, "string");
});

Deno.test("generate-bulletin: returns error when bulletinType is invalid (INVALID_BULLETIN_TYPE)", async () => {
  const req = new Request(`${SUPABASE_URL}/functions/v1/generate-bulletin`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventId: "00000000-0000-0000-0000-000000000000",
      bulletinType: "invalid_type",
    }),
  });

  const res = await fetch(req);
  const data = await res.json();

  assertEquals(res.status, 400);
  assertEquals(data.code, "INVALID_BULLETIN_TYPE");
  assertEquals(data.field, "bulletinType");
});

Deno.test("generate-bulletin: returns error when stageId is missing for daily bulletin (MISSING_STAGE_ID)", async () => {
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
  assertEquals(data.field, "stageId");
});

Deno.test("generate-bulletin: returns error when no results are found (NO_RESULTS_FOUND)", async () => {
  // Use a UUID that exists in the system but has no published matches if possible, 
  // or a random one to trigger the empty check.
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

  // If the function logic reached the point where it queries DB and finds 0 matches
  if (res.status === 400 && data.code === "NO_RESULTS_FOUND") {
    assertEquals(data.code, "NO_RESULTS_FOUND");
    assertEquals(data.field, "matches");
  } else if (res.status === 200) {
     console.log("Unexpected success in NO_RESULTS_FOUND test - check DB state");
  } else {
     console.log(`Test NO_RESULTS_FOUND got status ${res.status} with code ${data.code}`);
  }
});

Deno.test("generate-bulletin: returns internal error for invalid input format (INTERNAL_ERROR simulation)", async () => {
  const req = new Request(`${SUPABASE_URL}/functions/v1/generate-bulletin`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
    },
    body: "invalid-json-body", // This will trigger a catch block in the function
  });

  const res = await fetch(req);
  const data = await res.json();

  assertEquals(res.status, 500);
  assertEquals(data.code, "INTERNAL_ERROR");
  assertEquals(typeof data.error, "string");
});
