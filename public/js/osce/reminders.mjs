/* osce/reminders.mjs - Daily reminders (founder 2026-10-26): at 9 AM a line from Confucius, at 6 PM, only on a day MDosce
   was not opened, "<your dog> is sad". Web Push: the phone's subscription goes to pup_push through the token-checked
   functions of supabase/migrations/0009_pup_push.sql; the edge function pup-push (pg_cron, every 10 minutes) decides
   what is due in the phone's own zone and sends it. sw.js is push-only. iOS: the Home Screen app only, Safari 16.4+.
   Every open marks the local day as opened (opened()), so a day you came back brings no sad note. */
import { lsGet } from '../study-kit/store.mjs';
import { ACCOUNT_LS } from '../study-kit/sync.mjs';

const VAPID = 'BDLTElOzU-VWrqpDPsXN1BSqu4OmPPGiVFbR-r6aU4LlLKeuzQ67OvepmLC2usiLE0r0SdwvVlAP0YRb5lIenRY';
const cfg = () => (typeof window !== 'undefined' && window.OSCE_CONFIG) || {};
const key8 = b => Uint8Array.from(atob(b.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - b.length % 4) % 4)), c => c.charCodeAt(0));
const iosTab = () => /iP(hone|ad|od)/.test(navigator.userAgent) && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches;
/* the phone's own date, YYYY-MM-DD */
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/* the dog the notes name: the duel account's dog, else none (the sender says "Your dog") */
export async function dogName() {   /* the roster loads only here, not with the app (audit 2026-10-29: 106 KB at boot) */
  const a = lsGet(ACCOUNT_LS, null), id = a && a.look && a.look.dog;
  if (!id) return '';
  const { ROSTER } = await import('../vendor/pup-duel/pup/rig/breeds.mjs');
  return (ROSTER.find(d => d.id === id) || {}).name || '';
}

async function rpc(fn, args) {
  const { supabaseUrl: url, supabaseAnonKey: k } = cfg();
  if (!url || !k) throw new Error('no project');
  const r = await fetch(`${String(url).replace(/\/+$/, '')}/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(args),
    headers: { 'Content-Type': 'application/json', apikey: k, ...(String(k).split('.').length === 3 ? { Authorization: `Bearer ${k}` } : {}) } });
  if (!r.ok) throw new Error(`${fn} ${r.status}`);
}

/* 'on' | 'off' | 'install' (iPhone: add to Home Screen first) | 'denied' | 'none' (no push here, or no project) */
export async function status() {
  try {
    if (!cfg().supabaseUrl) return 'none';
    if (iosTab()) return 'install';
    if (!('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window)) return 'none';
    if (Notification.permission === 'denied') return 'denied';
    const r = await navigator.serviceWorker.getRegistration('./');
    r?.update().catch(() => {});
    return r && await r.pushManager.getSubscription() ? 'on' : 'off';
  } catch { return 'none'; }
}
export async function turnOn() {
  const perm = await Notification.requestPermission();   /* first, inside the tap: iOS only asks from a gesture */
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.register('./sw.js');
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key8(VAPID) });
  const a = lsGet(ACCOUNT_LS, null);
  await rpc('pup_push_save', { p_sub: sub.toJSON(), p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', p_dog: await dogName(), p_token: a && a.token || null, p_day: today() });
  return 'on';
}
export async function turnOff() {
  try {
    const r = await navigator.serviceWorker.getRegistration('./'), s = r && await r.pushManager.getSubscription();
    if (s) { await rpc('pup_push_off', { p_endpoint: s.endpoint }).catch(() => {}); await s.unsubscribe(); }
  } catch { /* already gone */ }
  return 'off';
}
/* MDosce opened today: no sad note tonight (quietly; a phone without reminders does nothing) */
export async function opened() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const r = await navigator.serviceWorker.getRegistration('./'), s = r && await r.pushManager.getSubscription();
    if (s) await rpc('pup_push_opened', { p_endpoint: s.endpoint, p_day: today(), p_dog: (await dogName()) || null });
  } catch { /* offline: the 6 PM note may come, nothing breaks */ }
}
