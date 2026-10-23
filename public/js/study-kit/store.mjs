/* store.mjs — guarded localStorage for the study overlays (study kit, plan 2026-10-19-001 unit K2).
   Every read and write is wrapped: a private window, cleared site data, a full quota or junk in a key must never stop
   a session (the audit counted 15 hand-written try/catch sites). JSON values through lsGet/lsSet; raw strings through
   lsGetRaw/lsSetRaw (null removes the key). Nothing here knows what the keys mean. */

export function lsGet(key, fallback) {
  try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }
}
export function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export function lsGetRaw(key, fallback = '') {
  try { const v = localStorage.getItem(key); return v == null ? fallback : v; } catch { return fallback; }
}
export function lsSetRaw(key, value) {
  try { if (value == null) localStorage.removeItem(key); else localStorage.setItem(key, String(value)); return true; } catch { return false; }
}
