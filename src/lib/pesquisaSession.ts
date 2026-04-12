// Pesquisa PWA session management with offline queue

const STORAGE_KEYS = {
  SESSION: 'pesquisa_session',
  DEVICE_ID: 'pesquisa_device_id',
  QUEUE: 'pesquisa_queue',
  DRAFT: 'pesquisa_draft',
};

export interface PesquisaSession {
  session_id: string;
  expires_at: string;
  researcher: { id: string; name: string; event_id: string };
  event: { id: string; name: string; location: string | null; event_date: string | null };
}

export interface QueueItem {
  client_uuid: string;
  payload: Record<string, unknown>;
  created_at: string;
  attempts: number;
  last_error: string | null;
}

export function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
  }
  return id;
}

export function getSession(): PesquisaSession | null {
  const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as PesquisaSession;
    if (new Date(session.expires_at) < new Date()) {
      clearSession();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: PesquisaSession) {
  localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEYS.SESSION);
  localStorage.removeItem(STORAGE_KEYS.DRAFT);
}

export function getQueue(): QueueItem[] {
  const raw = localStorage.getItem(STORAGE_KEYS.QUEUE);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function saveQueue(queue: QueueItem[]) {
  localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
}

export function addToQueue(item: QueueItem) {
  const queue = getQueue();
  queue.push(item);
  saveQueue(queue);
}

export function removeFromQueue(clientUuid: string) {
  const queue = getQueue().filter(q => q.client_uuid !== clientUuid);
  saveQueue(queue);
}

export function getDraft(): Record<string, unknown> | null {
  const raw = localStorage.getItem(STORAGE_KEYS.DRAFT);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function saveDraft(draft: Record<string, unknown>) {
  localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(draft));
}

export function clearDraft() {
  localStorage.removeItem(STORAGE_KEYS.DRAFT);
}
