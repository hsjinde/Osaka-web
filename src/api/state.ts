const BASE = import.meta.env.VITE_API_BASE as string | undefined;
const TOKEN_KEY = 'osaka-dash-token';
const QUEUE_KEY = 'osaka-state-queue';

export function getToken(): string | null { return localStorage.getItem(TOKEN_KEY); }
export function setToken(t: string): void { localStorage.setItem(TOKEN_KEY, t); }
export function configured(): boolean { return !!BASE && !!getToken(); }

function headers(): HeadersInit {
  return { Authorization: `Bearer ${getToken() ?? ''}`, 'Content-Type': 'application/json' };
}

export async function fetchState(): Promise<Record<string, boolean>> {
  const res = await fetch(`${BASE}/api/state`, { headers: headers() });
  if (!res.ok) throw new Error(`GET state ${res.status}`);
  return res.json();
}

export async function putState(key: string, value: boolean): Promise<void> {
  const res = await fetch(`${BASE}/api/state/${encodeURIComponent(key)}`, {
    method: 'PUT', headers: headers(), body: JSON.stringify({ value }),
  });
  if (!res.ok) throw new Error(`PUT state ${res.status}`);
}

type Queue = Record<string, boolean>;
function readQueue(): Queue {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '{}'); } catch { return {}; }
}

export function queuePut(key: string, value: boolean): void {
  const q = readQueue();
  q[key] = value;
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function flushQueue(): Promise<number> {
  const q = readQueue();
  const entries = Object.entries(q);
  if (entries.length === 0) return 0;
  let sent = 0;
  for (const [key, value] of entries) {
    try {
      await putState(key, value);
      delete q[key];
      sent++;
    } catch { break; }
  }
  if (Object.keys(q).length === 0) localStorage.removeItem(QUEUE_KEY);
  else localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  return sent;
}