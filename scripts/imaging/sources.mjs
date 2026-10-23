/* imaging/sources.mjs - where candidate images come from, as plain search clients: Wikimedia Commons (every file has
   its licence, author and description in extmetadata) and Open-i, the US National Library of Medicine's search over
   open-access biomedical images. The URL builders and parsers are pure (tested against recorded response shapes in
   scripts/imaging.test.js); search() does the fetching and takes the fetch to use, so it can be stubbed. */

export const UA = 'osce-prep-imaging/1.0 (study tool; https://github.com/Stef-01/Med-OS)';   /* Wikimedia asks every client to say who it is */
const strip = s => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/\s+/g, ' ').trim();

/* ---------------------------------------------------------------- Wikimedia Commons */
export function commonsUrl(query, limit = 20) {
  const u = new URL('https://commons.wikimedia.org/w/api.php');
  const p = { action: 'query', format: 'json', formatversion: '2', generator: 'search', gsrsearch: `${query} filetype:bitmap`, gsrnamespace: '6', gsrlimit: String(limit),
    prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata', iiurlwidth: '1280',
    iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|Credit|ImageDescription|Categories|ObjectName|AttributionRequired', origin: '*' };
  for (const [k, v] of Object.entries(p)) u.searchParams.set(k, v);
  return u.toString();
}
export function parseCommons(json) {
  const pages = Array.isArray(json?.query?.pages) ? json.query.pages : Object.values(json?.query?.pages || {});
  return pages.map(pg => {
    const ii = (pg.imageinfo || [])[0]; if (!ii) return null;
    const md = ii.extmetadata || {}, v = k => strip(md[k]?.value);
    return {
      source: 'commons', via: 'Wikimedia Commons', title: String(pg.title || '').replace(/^File:/, ''),
      description: v('ImageDescription') || v('ObjectName'), categories: v('Categories').split('|').map(s => s.trim()).filter(Boolean),
      url: ii.thumburl || ii.url, original: ii.url, page: ii.descriptionurl || '',
      width: ii.thumbwidth || ii.width || 0, height: ii.thumbheight || ii.height || 0, mime: ii.mime || '',
      license: v('LicenseShortName'), licenseUrl: md.LicenseUrl?.value || '', author: v('Artist') || v('Credit'),
    };
  }).filter(Boolean);
}

/* ---------------------------------------------------------------- Open-i (openi.nlm.nih.gov)
   `it` is the image type (x X-ray, c CT, u ultrasound, m MRI, ph photograph). Image paths in the reply are relative to
   the host. Only results that carry a recognisable licence get through rank.mjs. */
export const OPENI = 'https://openi.nlm.nih.gov';
export function openiUrl(query, type = 'x', n = 20) {
  const u = new URL(`${OPENI}/api/search`);
  u.searchParams.set('query', query);
  if (type) u.searchParams.set('it', type);
  u.searchParams.set('m', '1'); u.searchParams.set('n', String(n));
  return u.toString();
}
export function parseOpeni(json) {
  return (Array.isArray(json?.list) ? json.list : []).map(it => {
    const img = it.imgLarge || it.imgGrid150 || it.imgThumb; if (!img) return null;
    const abs = p => (/^https?:/.test(p) ? p : `${OPENI}${p.startsWith('/') ? '' : '/'}${p}`);
    const mesh = [...(it.MeSH?.major || []), ...(it.MeSH?.minor || [])].map(strip);
    return {
      source: 'openi', via: 'Open-i (NLM)', title: strip(it.title), description: strip(it.image?.caption), categories: [], mesh,
      url: abs(img), original: abs(img), page: it.detailedQueryURL ? abs(it.detailedQueryURL) : it.uid ? `${OPENI}/detailedresult?img=${encodeURIComponent(it.uid)}` : '',
      width: 0, height: 0, mime: /\.png$/i.test(img) ? 'image/png' : 'image/jpeg',
      license: strip(it.licenseTag || it.license || ''), licenseUrl: '', author: strip(it.authors || it.journal_title || ''),
    };
  }).filter(Boolean);
}

/* ---------------------------------------------------------------- search: every query on both sources, failures tolerated */
export async function search(req, queries, { fetch: f = fetch, modalities, log = () => {} } = {}) {
  const out = [], type = modalities?.[req.modality]?.openi ?? 'x';
  const get = async url => { const r = await f(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } }); if (!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); };
  for (const q of queries) {
    try { out.push(...parseCommons(await get(commonsUrl(q)))); } catch (e) { log(`commons: ${e.message}`); }
    if (type) { try { out.push(...parseOpeni(await get(openiUrl(q, type)))); } catch (e) { log(`open-i: ${e.message}`); } }
  }
  return out;
}
