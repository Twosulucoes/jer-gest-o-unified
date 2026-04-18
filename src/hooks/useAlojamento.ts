import { supabase } from "@/integrations/supabase/client";

export async function rpcResolveQr(token: string) {
  const { data, error } = await supabase.rpc("resolve_qr" as any, { p_token: token });
  if (error) throw error;
  return data as Record<string, any>;
}

export async function rpcCheckin(deviceId: string, token: string, facilityId: string, mode = "person_qr") {
  const { data, error } = await supabase.rpc("pwa_checkin" as any, {
    p_device_id: deviceId,
    p_token: token,
    p_facility_id: facilityId,
    p_mode: mode,
  });
  if (error) throw error;
  return data as Record<string, any>;
}

export async function rpcCheckout(deviceId: string, token: string, facilityId: string) {
  const { data, error } = await supabase.rpc("pwa_checkout" as any, {
    p_device_id: deviceId,
    p_token: token,
    p_facility_id: facilityId,
  });
  if (error) throw error;
  return data as Record<string, any>;
}

export async function rpcAssignBed(deviceId: string, personToken: string, bedToken: string) {
  const { data, error } = await supabase.rpc("pwa_assign_bed" as any, {
    p_device_id: deviceId,
    p_person_token: personToken,
    p_bed_token: bedToken,
  });
  if (error) throw error;
  return data as Record<string, any>;
}

export async function rpcSearchPerson(query: string, facilityId: string, limit = 20) {
  const { data, error } = await supabase.rpc("pwa_search_person" as any, {
    p_query: query,
    p_facility_id: facilityId,
    p_limit: limit,
  });
  if (error) throw error;
  return data as Record<string, any>;
}

export async function rpcGenerateQr(qrType: string, entityId: string) {
  const { data, error } = await supabase.rpc("admin_generate_qr" as any, {
    p_qr_type: qrType,
    p_entity_id: entityId,
  });
  if (error) throw error;
  return data as Record<string, any>;
}

// Device ID helper
export function getDeviceId(): string {
  const KEY = "jer_alj_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

// Facility persistence
export function getSelectedFacility(): string | null {
  return localStorage.getItem("jer_alj_facility_id");
}

export function setSelectedFacility(id: string) {
  localStorage.setItem("jer_alj_facility_id", id);
}
