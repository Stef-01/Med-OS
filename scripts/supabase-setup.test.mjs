import test from 'node:test';
import assert from 'node:assert/strict';
import { pickPublicKey, writeConfig, pinCsp, runSql, projectUrl, PROJECT_REF } from './lib/supabase-setup.mjs';

test('Med-OS has its own project, not Optimus', () => {
  assert.equal(projectUrl(PROJECT_REF), 'https://pquajwxvlpvaygrkzfkl.supabase.co');
});

test('the browser gets the publishable key, else anon, never a secret', () => {
  assert.equal(pickPublicKey([{ type: 'secret', api_key: 's' }, { type: 'publishable', api_key: 'sb_publishable_x' }]), 'sb_publishable_x');
  assert.equal(pickPublicKey([{ name: 'service_role', api_key: 's' }, { name: 'anon', api_key: 'a' }]), 'a');
  assert.equal(pickPublicKey([{ name: 'service_role', api_key: 's' }, { type: 'secret', api_key: 't' }]), null);
  assert.equal(pickPublicKey(null), null);
});

test('config.js is filled in place, the comment kept, and refilled', () => {
  const t = "/* note */\nwindow.OSCE_CONFIG = {\n  supabaseUrl: '',\n  supabaseAnonKey: '',\n};";
  const out = writeConfig(t, 'https://r.supabase.co', "k'1");
  assert.match(out, /^\/\* note \*\//);
  assert.match(out, /supabaseUrl: 'https:\/\/r\.supabase\.co'/);
  assert.ok(out.includes("supabaseAnonKey: 'k\\'1'"));
  assert.ok(writeConfig(out, 'https://s.supabase.co', 'k2').includes("supabaseAnonKey: 'k2',"));
  assert.throws(() => writeConfig('nothing', 'u', 'k'));
});

test('the CSP is pinned to the one project', () => {
  const v = "connect-src 'self' https://*.supabase.co wss://*.supabase.co; x";
  assert.equal(pinCsp(v, 'abc'), "connect-src 'self' https://abc.supabase.co wss://abc.supabase.co; x");
  assert.equal(pinCsp(pinCsp(v, 'abc'), 'def'), "connect-src 'self' https://def.supabase.co wss://def.supabase.co; x");
});

test('runSql posts the query with the token and reports failures', async () => {
  const calls = [];
  const res = await runSql('abc', 'tok', 'select 1', async (url, o) => { calls.push({ url, o }); return { ok: true, json: async () => [{ a: 1 }] }; });
  assert.deepEqual(res, [{ a: 1 }]);
  assert.equal(calls[0].url, 'https://api.supabase.com/v1/projects/abc/database/query');
  assert.equal(calls[0].o.headers.Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(calls[0].o.body), { query: 'select 1' });
  await assert.rejects(runSql('abc', 't', 'x', async () => ({ ok: false, status: 401, text: async () => 'no' })), /401/);
});
