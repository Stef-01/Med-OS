/* pup-push: MDosce's two daily notifications (supabase/migrations/0009_pup_push.sql). pg_cron calls it every 10 minutes;
   for every active pup_push subscription plan.mjs says what is due in the phone's own zone (a 9 AM line from Confucius,
   a 6 PM "your dog is sad" on a day the app was not opened), it sends each once, encrypted with the VAPID key from
   Vault (pup_push_key(), service role only), and marks the day. 404/410 from the push service: the phone dropped the
   subscription, active = false.
     POST /functions/v1/pup-push          the cron run
     POST /functions/v1/pup-push?dry=1    what each phone would get now; sends and writes nothing */
import * as webpush from 'jsr:@negrel/webpush@0.5.0';
import { due } from './plan.mjs';

const SB = Deno.env.get('SUPABASE_URL')!, KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SITE = 'https://mdosce.vercel.app';
export const VAPID_PUBLIC = 'BDLTElOzU-VWrqpDPsXN1BSqu4OmPPGiVFbR-r6aU4LlLKeuzQ67OvepmLC2usiLE0r0SdwvVlAP0YRb5lIenRY';

type Sub = { endpoint: string; p256dh: string; auth: string; tz: string | null; dog: string | null; opened_on: string | null; sad_on: string | null; quote_on: string | null };

async function rest(method: string, path: string, body?: unknown, prefer = 'return=minimal') {
  const r = await fetch(`${SB}/rest/v1/${path}`, {
    method, body: body === undefined ? undefined : JSON.stringify(body),
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Prefer: prefer },
  });
  if (!r.ok) throw new Error(`${method} ${path.split('?')[0]}: ${r.status} ${(await r.text()).slice(0, 200)}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - s.length % 4) % 4)), c => c.charCodeAt(0));

let app: webpush.ApplicationServer | null = null;
async function server() {
  if (app) return app;
  const d = await rest('POST', 'rpc/pup_push_key', {}, 'return=representation');
  if (typeof d !== 'string' || d.length !== 43) throw new Error('the VAPID key is not in Vault (pup_push_key)');
  const raw = unb64u(VAPID_PUBLIC), x = b64u(raw.slice(1, 33)), y = b64u(raw.slice(33, 65));
  const vapidKeys = await webpush.importVapidKeys({
    publicKey: { kty: 'EC', crv: 'P-256', x, y, ext: true },
    privateKey: { kty: 'EC', crv: 'P-256', x, y, d, ext: false },
  });
  app = await webpush.ApplicationServer.new({ contactInformation: SITE, vapidKeys });
  return app;
}

Deno.serve(async req => {
  const dry = new URL(req.url).searchParams.has('dry'), now = new Date();
  const out = { at: now.toISOString(), subscriptions: 0, due: 0, sent: 0, gone: 0, errors: 0, plan: [] as unknown[] };
  try {
    const subs: Sub[] = await rest('GET', 'pup_push?active=eq.true&select=endpoint,p256dh,auth,tz,dog,opened_on,sad_on,quote_on', undefined, 'return=representation');
    out.subscriptions = subs.length;
    for (const s of subs) {
      const list = due(s, now);
      out.due += list.length;
      if (dry) { out.plan.push(...list.map(m => ({ kind: m.kind, day: m.day, title: m.title }))); continue; }
      for (const m of list) {
        try {
          const sub = (await server()).subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } });
          await sub.pushTextMessage(JSON.stringify({ title: m.title, body: m.body, kind: m.kind }), { ttl: 3 * 3600, urgency: webpush.Urgency.Normal });
          await rest('PATCH', `pup_push?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { [m.mark]: m.day, updated_at: now.toISOString() });
          out.sent++;
        } catch (e) {
          const gone = e instanceof webpush.PushMessageError && (e.response.status === 404 || e.response.status === 410);
          if (gone) { out.gone++; await rest('PATCH', `pup_push?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { active: false, updated_at: now.toISOString() }); break; }
          out.errors++; console.error(`pup-push ${m.kind}: ${String((e as Error).message).slice(0, 200)}`);
        }
      }
    }
  } catch (e) { out.errors++; console.error(String((e as Error).message)); }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});
