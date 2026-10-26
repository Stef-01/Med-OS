/* the daily notifications (supabase/functions/pup-push/plan.mjs): a 9 AM line from Confucius, a 6 PM sad note on a day
   the app was not opened, each once a day, in the phone's own zone */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { due, localOf, quoteFor, QUOTES } from '../supabase/functions/pup-push/plan.mjs';

const at = iso => new Date(iso);
const sub = (o = {}) => ({ tz: 'Australia/Sydney', dog: 'Mochi', opened_on: null, sad_on: null, quote_on: null, ...o });

test('pup-push: the phone\'s own clock, a bad zone read as UTC', () => {
  assert.deepEqual(localOf(at('2026-10-26T22:05:00Z'), 'Australia/Sydney'), { day: '2026-10-27', min: 9 * 60 + 5 });
  assert.deepEqual(localOf(at('2026-10-26T22:05:00Z'), 'Not/AZone'), { day: '2026-10-26', min: 22 * 60 + 5 });
});

test('pup-push: 9 AM a quote, once; 6 PM the sad note only when the app was not opened, once', () => {
  const nine = at('2026-10-26T22:10:00Z'), six = at('2026-10-27T07:10:00Z');   /* 09:10 and 18:10 in Sydney on the 27th */
  const q = due(sub(), nine);
  assert.equal(q.length, 1); assert.equal(q[0].kind, 'quote'); assert.equal(q[0].mark, 'quote_on'); assert.equal(q[0].day, '2026-10-27');
  assert.match(q[0].body, /^“.+” \(Analects \d+\.\d+\)$/);
  assert.deepEqual(due(sub({ quote_on: '2026-10-27' }), nine), [], 'once a day');
  const s = due(sub(), six);
  assert.equal(s.length, 1); assert.equal(s[0].kind, 'sad'); assert.equal(s[0].title, 'Mochi is sad'); assert.match(s[0].body, /didn't log in today/);
  assert.deepEqual(due(sub({ opened_on: '2026-10-27' }), six), [], 'opened today: no sad note');
  assert.deepEqual(due(sub({ sad_on: '2026-10-27' }), six), [], 'once a day');
  assert.equal(due(sub({ dog: '' }), six)[0].title, 'Your dog is sad');
  assert.deepEqual(due(sub(), at('2026-10-27T03:00:00Z')), [], '2 PM: nothing (a missed window is not sent late)');
  assert.deepEqual(due(sub(), at('2026-10-27T11:30:00Z')), [], '10:30 PM: nothing');
});

test('pup-push: a different quote each day, every one from the Analects as Legge put it', () => {
  const days = Array.from({ length: QUOTES.length }, (_, i) => quoteFor(`2026-11-${String(i + 1).padStart(2, '0')}`)[1]);
  assert.equal(new Set(days).size, QUOTES.length, 'eleven days, eleven quotes');
  for (const [q, ref] of QUOTES) { assert.ok(q.length <= 160, ref); assert.match(ref, /^\d+\.\d+$/); }
});

test('pup-push: the migration keeps the table closed and the key in Vault', () => {
  const sql = fs.readFileSync(new URL('../supabase/migrations/0009_pup_push.sql', import.meta.url), 'utf8');
  assert.match(sql, /revoke all on public\.pup_push from anon, authenticated/);
  assert.match(sql, /revoke all on function public\.pup_push_key\(\) from public, anon, authenticated/);
  assert.doesNotMatch(sql, /vault\.create_secret/, 'the private key is set by hand, never committed');
  const fn = fs.readFileSync(new URL('../supabase/functions/pup-push/index.ts', import.meta.url), 'utf8');
  const js = fs.readFileSync(new URL('../public/js/osce/reminders.mjs', import.meta.url), 'utf8');
  assert.equal(/VAPID_PUBLIC = '([^']+)'/.exec(fn)[1], /VAPID = '([^']+)'/.exec(js)[1], 'the app subscribes with the key the sender signs with');
});
