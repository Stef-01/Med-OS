/* supabase-setup.mjs - the pure half of scripts/supabase-setup.mjs: Med-OS's own Supabase project, not Optimus's.
   fetch is passed in, so the tests run with no network. The Management API needs a personal access token
   (SUPABASE_ACCESS_TOKEN, from supabase.com/dashboard/account/tokens); the site only ever sees the project's
   publishable (anon) key. */
export const PROJECT_REF = 'pquajwxvlpvaygrkzfkl';
export const API = 'https://api.supabase.com/v1';

export const projectUrl = ref => `https://${ref}.supabase.co`;

/* the key the browser may hold: the publishable key when the project has one, else the legacy anon key; never a secret */
export function pickPublicKey(keys) {
  const list = Array.isArray(keys) ? keys : [];
  const pub = list.find(k => k && k.type === 'publishable' && k.api_key);
  if (pub) return pub.api_key;
  const anon = list.find(k => k && k.name === 'anon' && k.api_key);
  return anon ? anon.api_key : null;
}

/* config.js's text with the project filled in, the comment kept */
export function writeConfig(text, url, key) {
  const q = s => String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const t = String(text);
  if (!/supabaseUrl\s*:\s*'[^']*'/.test(t) || !/supabaseAnonKey\s*:\s*'[^']*'/.test(t)) throw new Error('config.js has no supabaseUrl / supabaseAnonKey fields');
  return t.replace(/supabaseUrl\s*:\s*'[^']*'/, () => `supabaseUrl: '${q(url)}'`)
    .replace(/supabaseAnonKey\s*:\s*'(?:[^'\\]|\\.)*'/, () => `supabaseAnonKey: '${q(key)}'`);
}

/* vercel.json's CSP connect-src narrowed from any Supabase project to this one */
export function pinCsp(vercelText, ref) {
  return String(vercelText).replace(/https:\/\/[*a-z0-9]+\.supabase\.co wss:\/\/[*a-z0-9]+\.supabase\.co/g, `https://${ref}.supabase.co wss://${ref}.supabase.co`);
}

const auth = token => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

/* one migration file's SQL, run as one query against the project's database */
export async function runSql(ref, token, sql, fetch) {
  const r = await fetch(`${API}/projects/${ref}/database/query`, { method: 'POST', headers: auth(token), body: JSON.stringify({ query: sql }) });
  if (!r.ok) throw new Error(`query: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function apiKeys(ref, token, fetch) {
  const r = await fetch(`${API}/projects/${ref}/api-keys?reveal=true`, { headers: auth(token) });
  if (!r.ok) throw new Error(`api-keys: ${r.status} ${await r.text()}`);
  return r.json();
}
