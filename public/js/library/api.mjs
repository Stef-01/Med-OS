/* library/api.mjs - where your questions live (docs/library.md). Signed in (Settings, the duel's account), on the
   account: the token-checked functions of supabase/migrations/0008_library.sql, with the last answer kept on this
   device (so the duel and Study work offline, and open at once). Signed out, on this device only: friends and sharing
   need an account. Study progress is a third thing, synced like the OSCE record (study-kit/sync.mjs, ns 'lib').

     lib { signedIn, me: { id, name } | null, decks: [{ id, name, items, shared: [friend id] }],
           shared: [{ id, name, owner, owner_name, items }], friends: [{ id, name, status }], at } */
import { lsGet, lsSet } from '../study-kit/store.mjs';
import { account, changed as syncChanged, pull as syncPull } from '../study-kit/sync.mjs';
import { rpc } from '../osce/account.mjs';
import { LIMITS } from './item.mjs';

const LOCAL = 'osce.lib.local.v1';                 /* signed out: { decks: [{ id, name, items, shared: [] }] } */
const CACHE = id => `osce.lib.cache.v1:${id}`;    /* signed in: the last lib_library + friend_list, per account */
export const STUDY = 'osce.libstudy.v1';          /* { card: { key: card }, day: { d, n } } (sync.mjs SPEC.lib) */

const arr = v => (Array.isArray(v) ? v : []);
const deckOf = d => ({ id: String(d?.id || ''), name: String(d?.name || ''), items: arr(d?.items).filter(x => x && typeof x.id === 'string'), shared: arr(d?.shared).map(String) });

/* what this device has now, with no network: the cache when signed in, else the local library */
export function current() {
  const a = account();
  if (a) {
    const c = lsGet(CACHE(a.id), null) || {};
    return { signedIn: true, me: { id: a.id, name: a.name }, decks: arr(c.decks).map(deckOf), shared: arr(c.shared).map(d => ({ ...deckOf(d), owner: String(d.owner || ''), owner_name: String(d.owner_name || '') })), friends: arr(c.friends), at: c.at || 0 };
  }
  const l = lsGet(LOCAL, null) || {};
  return { signedIn: false, me: null, decks: arr(l.decks).map(deckOf), shared: [], friends: [], at: 0 };
}

/* fetch the account's library and friends (signed in), keep it, and return it; offline, the cache */
export async function refresh() {
  const a = account(); if (!a) return current();
  const [lib, friends] = await Promise.all([rpc('lib_library', { p_token: a.token }), rpc('friend_list', { p_token: a.token })]);
  lsSet(CACHE(a.id), { decks: arr(lib?.decks), shared: arr(lib?.shared), friends: arr(friends), at: Date.now() });
  return current();
}

/* save checked items (library/item.mjs) to a deck by name: { name, added } */
export async function upload(name, items) {
  const a = account();
  if (a) {
    let r;
    for (let i = 0; i < items.length; i += LIMITS.upload) r = await rpc('lib_upload', { p_token: a.token, p_deck: name, p_items: items.slice(i, i + LIMITS.upload) });
    await refresh().catch(() => {});
    return { name: r?.name || name, added: items.length };
  }
  const l = lsGet(LOCAL, null) || { decks: [] }, decks = arr(l.decks);
  const total = decks.reduce((n, d) => n + arr(d.items).length, 0);
  if (total + items.length > LIMITS.items) throw new Error(`That would make ${total + items.length} questions: ${LIMITS.items} is the most`);
  let d = decks.find(x => x.name === name);
  if (!d) { if (decks.length >= LIMITS.decks) throw new Error(`You have ${LIMITS.decks} decks: delete one first`); d = { id: `l-${Date.now().toString(36)}`, name, items: [], shared: [] }; decks.unshift(d); }
  const ids = new Set(items.map(x => x.id));
  for (const x of decks) x.items = arr(x.items).filter(it => !ids.has(it.id));
  d.items.push(...items);
  lsSet(LOCAL, { decks });
  return { name, added: items.length };
}

/* delete a question (id) or a whole deck (id null) of yours */
export async function remove(deck, id = null) {
  const a = account();
  if (a) { await rpc('lib_delete', { p_token: a.token, p_deck: deck, p_item: id }); return refresh(); }
  const l = lsGet(LOCAL, null) || { decks: [] };
  const decks = arr(l.decks).map(d => (d.id === deck && id ? { ...d, items: arr(d.items).filter(x => x.id !== id) } : d)).filter(d => !(d.id === deck && !id));
  lsSet(LOCAL, { decks });
  return current();
}

export async function rename(deck, name) {
  const a = account();
  if (a) { await rpc('lib_rename', { p_token: a.token, p_deck: deck, p_name: name }); return refresh(); }
  const l = lsGet(LOCAL, null) || { decks: [] };
  if (arr(l.decks).some(d => d.name === name && d.id !== deck)) throw new Error('You have a deck called that already');
  lsSet(LOCAL, { decks: arr(l.decks).map(d => (d.id === deck ? { ...d, name } : d)) });
  return current();
}

/* friends: these need an account */
const tok = () => { const a = account(); if (!a) throw new Error('Sign in first, in Settings'); return a.token; };
export const addFriend = async name => { const r = await rpc('friend_request', { p_token: tok(), p_name: name }); await refresh(); return r; };
export const answerFriend = async (id, accept) => { const r = await rpc('friend_respond', { p_token: tok(), p_other: id, p_accept: accept }); await refresh(); return r; };
export const share = async (deck, friend, on) => { const r = await rpc('lib_share', { p_token: tok(), p_deck: deck, p_friend: friend, p_on: on }); await refresh(); return r; };

/* the device's local library goes onto the account the first time it signs in (nothing is lost by signing in) */
export async function adoptLocal() {
  const a = account(), l = lsGet(LOCAL, null);
  if (!a || !l || !arr(l.decks).length) return 0;
  let n = 0;
  for (const d of arr(l.decks)) if (arr(d.items).length) { await upload(d.name, arr(d.items)); n += d.items.length; }
  lsSet(LOCAL, null);
  return n;
}

/* ---------- Study progress ---------- */
export const studyMem = () => { const m = lsGet(STUDY, null) || {}; if (!m.card || typeof m.card !== 'object') m.card = {}; if (!m.day || typeof m.day !== 'object') m.day = { d: '', n: 0 }; return m; };
export function saveStudy(m) { lsSet(STUDY, m); syncChanged('lib'); }
export const pullStudy = () => syncPull('lib');
/* the key a question's card is kept under: your own by id, a friend's with its owner (two people's ids may meet) */
export const cardKey = (it, owner) => (owner ? `f:${owner}:${it.id}` : it.id);

/* every question you can study or duel on: [{ item, deck, owner, ownerName, key }] (yours first) */
export function allItems(lib) {
  const out = [];
  for (const d of lib.decks) for (const it of d.items) out.push({ item: it, deck: d.id, deckName: d.name, owner: '', ownerName: '', key: cardKey(it, '') });
  for (const d of lib.shared) for (const it of d.items) out.push({ item: it, deck: d.id, deckName: d.name, owner: d.owner, ownerName: d.owner_name, key: cardKey(it, d.owner) });
  return out;
}
