/* the library's functions (supabase/migrations/0008_library.sql) in memory, for the e2e: the same rules and the same
   error words, over the duel's fake players (the account is the duel's). Never the live project. */
export function libraryFake({ byToken, players }) {
  const decks = new Map(), items = new Map(), friends = new Map(), shares = new Set(), picks = new Map();
  const fail = m => { throw new Error(m); };
  const pair = (p, q) => (p < q ? `${p}|${q}` : `${q}|${p}`);
  const areFriends = (p, q) => friends.get(pair(p, q))?.status === 'friends';
  const norm = s => String(s ?? '').replace(/\s+/g, ' ').trim();
  const itemsOf = d => [...items.values()].filter(x => x.deck === d).sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)).map(x => x.item);
  const sharedWith = d => [...shares].filter(k => k.startsWith(`${d}|`)).map(k => k.split('|')[1]);
  let seq = 0;
  return {
    /* 0009_mcq_picks.sql */
    mcq_pick({ p_qid, p_choice }) { if (!/^[A-Za-z0-9._-]{3,80}$/.test(p_qid || '') || /^u-/.test(p_qid) || !(p_choice >= 0 && p_choice <= 5)) return null; const k = `${p_qid}|${p_choice}`; picks.set(k, (picks.get(k) || 0) + 1); return null; },
    mcq_picks({ p_qid }) { const ks = [...picks.keys()].filter(k => k.startsWith(`${p_qid}|`)).map(k => +k.split('|')[1]); if (!ks.length) return []; return Array.from({ length: Math.max(...ks) + 1 }, (_, c) => picks.get(`${p_qid}|${c}`) || 0); },
    lib_upload({ p_token, p_deck, p_items }) {
      const me = byToken(p_token), nm = norm(p_deck);
      if (nm.length < 1 || nm.length > 40) fail('Name the deck (1 to 40 characters)');
      if (!Array.isArray(p_items) || !p_items.length) fail('Nothing to save');
      if (p_items.length > 500) fail('At most 500 questions at once');
      let d = [...decks.values()].find(x => x.owner === me.id && x.name === nm);
      if (!d) {
        if ([...decks.values()].filter(x => x.owner === me.id).length >= 50) fail('You have 50 decks: delete one first');
        d = { id: `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`, owner: me.id, name: nm, updated_at: new Date().toISOString() }; decks.set(d.id, d);
      }
      p_items.forEach((it, i) => {
        const n = Array.isArray(it?.options) ? it.options.length : 0;
        if (!/^u-[a-z0-9]{6,24}$/.test(it?.id || '') || typeof it.stem !== 'string' || it.stem.length < 20 || n < 4 || n > 5 || !Number.isInteger(it.answer) || it.answer < 0 || it.answer >= n
          || !['skills', 'clinical', 'physio', 'anatomy'].includes(it.cat) || !it.topic || it.provenance?.kind !== 'user') fail(`Question ${i + 1} is not in the right shape`);
        if (/<\s*\/?\s*[a-z][^>]*>/i.test(JSON.stringify(it))) fail(`Question ${i + 1} has HTML in it: plain text only`);
        const k = `${me.id}|${it.id}`, had = items.get(k);
        items.set(k, { owner: me.id, id: it.id, deck: d.id, item: it, at: had?.at ?? Date.now() + i / 1000 });
      });
      const tot = [...items.values()].filter(x => x.owner === me.id).length;
      if (tot > 2000) fail(`That would make ${tot} questions: 2,000 is the most an account holds`);
      d.updated_at = new Date().toISOString();
      return { deck: d.id, name: d.name, added: p_items.length, total: tot };
    },
    lib_library({ p_token }) {
      const me = byToken(p_token), by = (a, b) => (a.updated_at < b.updated_at ? 1 : -1);
      return {
        me: me.id,
        decks: [...decks.values()].filter(d => d.owner === me.id).sort(by).map(d => ({ id: d.id, name: d.name, updated_at: d.updated_at, shared: sharedWith(d.id), items: itemsOf(d.id) })),
        shared: [...decks.values()].filter(d => sharedWith(d.id).includes(me.id) && areFriends(me.id, d.owner)).sort(by)
          .map(d => ({ id: d.id, name: d.name, owner: d.owner, owner_name: players()[d.owner]?.name || '', updated_at: d.updated_at, items: itemsOf(d.id) }))
      };
    },
    lib_delete({ p_token, p_deck, p_item = null }) {
      const me = byToken(p_token), d = decks.get(p_deck);
      if (!d || d.owner !== me.id) fail('Not your deck');
      const gone = [...items.entries()].filter(([, x]) => x.deck === p_deck && (p_item == null || x.id === p_item));
      for (const [k] of gone) items.delete(k);
      if (p_item == null) { decks.delete(p_deck); for (const k of [...shares]) if (k.startsWith(`${p_deck}|`)) shares.delete(k); }
      return gone.length;
    },
    lib_rename({ p_token, p_deck, p_name }) {
      const me = byToken(p_token), d = decks.get(p_deck), nm = norm(p_name);
      if (nm.length < 1 || nm.length > 40) fail('Name the deck (1 to 40 characters)');
      if (!d || d.owner !== me.id) fail('Not your deck');
      if ([...decks.values()].some(x => x.owner === me.id && x.name === nm && x.id !== p_deck)) fail('You have a deck called that already');
      d.name = nm; return { id: d.id, name: nm };
    },
    friend_request({ p_token, p_name }) {
      const me = byToken(p_token), o = Object.values(players()).find(p => p.name.toLowerCase() === norm(p_name).toLowerCase());
      if (!o) fail('Nobody is called that');
      if (o.id === me.id) fail('That is you');
      const k = pair(me.id, o.id), f = friends.get(k);
      if (f) {
        if (f.status === 'friends') return { status: 'friends', id: o.id, name: o.name };
        if (f.asked_by === o.id) { f.status = 'friends'; return { status: 'friends', id: o.id, name: o.name }; }
        return { status: 'sent', id: o.id, name: o.name };
      }
      friends.set(k, { asked_by: me.id, status: 'pending' });
      return { status: 'sent', id: o.id, name: o.name };
    },
    friend_respond({ p_token, p_other, p_accept }) {
      const me = byToken(p_token), k = pair(me.id, p_other), f = friends.get(k);
      if (!f) fail('No such request');
      if (p_accept) { if (f.asked_by === me.id && f.status === 'pending') fail('They have not answered yet'); f.status = 'friends'; return 'friends'; }
      friends.delete(k);
      for (const s of [...shares]) { const [d, fr] = s.split('|'), o = decks.get(d)?.owner; if ((o === me.id && fr === p_other) || (o === p_other && fr === me.id)) shares.delete(s); }
      return 'removed';
    },
    friend_list({ p_token }) {
      const me = byToken(p_token);
      return [...friends.entries()].filter(([k]) => k.split('|').includes(me.id)).map(([k, f]) => {
        const oid = k.split('|').find(x => x !== me.id), o = players()[oid];
        return { id: oid, name: o?.name || '', look: o?.look || {}, seen_at: o?.seen_at || '', status: f.status === 'friends' ? 'friends' : f.asked_by === me.id ? 'outgoing' : 'incoming' };
      });
    },
    lib_share({ p_token, p_deck, p_friend, p_on }) {
      const me = byToken(p_token), d = decks.get(p_deck);
      if (!d || d.owner !== me.id) fail('Not your deck');
      if (p_on) { if (!areFriends(me.id, p_friend)) fail('Only with a friend'); shares.add(`${p_deck}|${p_friend}`); }
      else shares.delete(`${p_deck}|${p_friend}`);
      return sharedWith(p_deck);
    }
  };
}
