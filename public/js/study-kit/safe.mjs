/* study-kit/safe.mjs — the ONE HTML trust model for Learn (plan unit C3, 2026-10-19; audit finding 5).

   eMedici's rich text (Question Bank, OSCE, Cases) and Stefan's own explanations (learn-mcq.json) are HTML rendered
   with innerHTML. Every renderer passes that HTML through safeHtml() first; the Python builders cut their output to
   the same list (public/allowlist.json, written by scripts/emit-allowlist.js); the shipped-data tests check it with
   allowlistCheck(). Three places, one definition.

   safeHtml is a tokenizer, not a DOM walk, so it runs identically in Node (tests, validator) and in the browser, and
   its output is serialised HTML:
     - tags outside ALLOW.tags: forbidden ones (ALLOW.drop) are removed with their content; the rest are unwrapped
       (their text stays);
     - attributes: only ALLOW.attrs[tag], each with a positive rule: href is http(s)://, src is a local relative
       path (no scheme, no leading /, no ..), width/height/colspan/rowspan are digits, scope is a table scope;
     - comments, doctype and processing instructions are removed; a stray "<" in text becomes "&lt;"; entities are
       kept as written;
     - <a> always gets target="_blank" rel="noreferrer"; <img> loading="lazy" decoding="async" (+ data-zoom with
       {zoomImages}); {tableClass} wraps each <table> in <div class="…"> for horizontal scrolling;
     - open tags are closed in order at the end, as a browser would.
   On HTML the builders already cut (no attributes, allowed tags only) the output is byte-identical to the input
   (asserted in scripts/safe.test.js over the shipped stations and cases). */

const list = a => Object.freeze([...a]);
const frozenSet = a => { const s = new Set(a); const no = () => { throw new TypeError('ALLOW is immutable'); }; s.add = s.delete = s.clear = no; return Object.freeze(s); };
export const ALLOW = Object.freeze({
  /* lower-case, as HTML and the Python builders spell them. Measured over public/ on 2026-10-19: the shipped files
     use p strong li ul em br ol h3 td sub sup tr th table tbody; the rest are the forms eMedici's editor and Stefan's
     explanations can produce (b/i/h4 are also what the builders accept and fold to strong/em/h3). */
  tags: frozenSet(['p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 'sub', 'sup', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote',
    'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'a', 'img']),
  attrs: Object.freeze({ a: list(['href']), img: list(['src', 'alt', 'width', 'height']), td: list(['colspan', 'rowspan', 'scope']), th: list(['colspan', 'rowspan', 'scope']) }),
  /* removed WITH their content; any other unknown tag is unwrapped */
  drop: list(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'form', 'input', 'button', 'textarea', 'select', 'link', 'meta']),
  /* HTML's void elements among the above: no end tag, so no content to skip (a stray <input> never swallows the rest) */
  void: list(['br', 'hr', 'img', 'embed', 'input', 'link', 'meta']),
});
const DROP = new Set(ALLOW.drop), VOID = new Set(ALLOW.void);

/* ---------- entities (for checking attribute values; text is passed through as written) ---------- */
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', tab: '\t', newline: '\n', colon: ':', sol: '/' };
export const decodeEntities = s => String(s).replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);?/gi, (m, e) => {
  if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m; }
  const v = NAMED[e.toLowerCase()]; return v == null ? m : v;
});
const encodeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/* ---------- attribute rules: tag + name + DECODED value -> ok ---------- */
const url = v => decodeEntities(v).replace(/[\u0000- \u007f]+/g, '');   /* the URL parser strips these too */
export function attrOk(tag, name, value) {
  if (!(ALLOW.attrs[tag] || []).includes(name)) return false;
  const v = decodeEntities(value).trim();
  switch (name) {
    case 'href': return /^https?:\/\/[^\s]+$/i.test(url(value));
    case 'src': return /^(?:\.\/)?[\w\-][\w\-./]*$/.test(url(value)) && !url(value).includes('..');   /* a local file under public/: no scheme, no leading /, no .., no % */
    case 'width': case 'height': case 'colspan': case 'rowspan': return /^\d{1,5}$/.test(v);
    case 'scope': return /^(row|col|rowgroup|colgroup)$/i.test(v);
    case 'alt': return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
    default: return false;
  }
}

/* ---------- the tokenizer: text | comment | start(name, attrs[], selfClosing) | end(name) ---------- */
const ATTR = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
export function tokenize(html) {
  const s = String(html == null ? '' : html), out = [];
  let i = 0, text = '';
  const flush = () => { if (text) { out.push({ t: 'text', v: text }); text = ''; } };
  while (i < s.length) {
    const c = s[i];
    if (c !== '<') { text += c; i++; continue; }
    const n = s[i + 1];
    if (n === '!' || n === '?') {   /* comment, doctype, CDATA, PI */
      flush();
      const close = s.startsWith('<!--', i) ? s.indexOf('-->', i + 4) : s.indexOf('>', i + 2);
      const end = close < 0 ? s.length : close + (s.startsWith('<!--', i) ? 3 : 1);
      out.push({ t: 'junk', v: s.slice(i, end) }); i = end; continue;
    }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/.exec(s.slice(i, i + 64));
    if (!m) { flush(); out.push({ t: 'lt' }); i++; continue; }   /* a lone "<": text, escaped */
    /* find the closing ">" honouring quotes */
    let j = i + m[0].length, q = '';
    for (; j < s.length; j++) { const ch = s[j]; if (q) { if (ch === q) q = ''; } else if (ch === '"' || ch === "'") q = ch; else if (ch === '>') break; }
    if (j >= s.length) { flush(); out.push({ t: 'lt' }); i++; continue; }   /* never closed: text */
    flush();
    const name = m[2].toLowerCase(), inner = s.slice(i + m[0].length, j);
    if (m[1]) out.push({ t: 'end', name });
    else {
      const attrs = []; let a; ATTR.lastIndex = 0;
      const body = inner.replace(/\/\s*$/, '');
      while ((a = ATTR.exec(body))) attrs.push({ name: a[1].toLowerCase(), value: a[2] ?? a[3] ?? a[4] ?? '' });
      out.push({ t: 'start', name, attrs, self: /\/\s*$/.test(inner) });
    }
    i = j + 1;
  }
  flush();
  return out;
}

/* ---------- safeHtml ---------- */
export function safeHtml(html, opts = {}) {
  if (html == null || html === '') return '';
  const out = [], stack = [];   /* stack: open allowed tags, in order */
  let skip = null, depth = 0;   /* inside a dropped element: its name and nesting depth */
  const closeTo = name => {   /* close open tags down to and including name (a browser's implied end tags) */
    const k = stack.lastIndexOf(name);
    if (k < 0) return;
    while (stack.length > k) { const t = stack.pop(); out.push(`</${t}>`); if (t === 'table' && opts.tableClass) out.push('</div>'); }
  };
  for (const tok of tokenize(html)) {
    if (skip) {
      if (tok.t === 'start' && tok.name === skip && !tok.self) depth++;
      else if (tok.t === 'end' && tok.name === skip && --depth === 0) skip = null;
      continue;
    }
    if (tok.t === 'text') { out.push(tok.v); continue; }
    if (tok.t === 'lt') { out.push('&lt;'); continue; }
    if (tok.t === 'junk') continue;
    const { name } = tok;
    if (tok.t === 'end') { if (ALLOW.tags.has(name) && !VOID.has(name)) closeTo(name); continue; }
    if (DROP.has(name)) { if (!VOID.has(name)) { skip = name; depth = 1; } continue; }
    if (!ALLOW.tags.has(name)) continue;   /* unknown: unwrapped */
    const attrs = [];
    for (const a of tok.attrs) if (attrOk(name, a.name, a.value) && !attrs.some(x => x[0] === a.name)) attrs.push([a.name, decodeEntities(a.value).trim()]);
    if (name === 'a') attrs.push(['target', '_blank'], ['rel', 'noreferrer']);
    if (name === 'img') { attrs.push(['loading', 'lazy'], ['decoding', 'async']); if (opts.zoomImages) attrs.push(['data-zoom', '']); }
    if (name === 'table' && opts.tableClass) out.push(`<div class="${encodeAttr(opts.tableClass)}">`);
    out.push(`<${name}${attrs.map(([k, v]) => v === '' && k === 'data-zoom' ? ` ${k}=""` : ` ${k}="${encodeAttr(v)}"`).join('')}>`);
    if (!VOID.has(name)) stack.push(name);
  }
  while (stack.length) { const t = stack.pop(); out.push(`</${t}>`); if (t === 'table' && opts.tableClass) out.push('</div>'); }
  return out.join('');
}

/* ---------- allowlistCheck: the validator's and the tests' view of the same rules ----------
   -> [] when the HTML is already what safeHtml would output, else one string per problem.
   {attrs: false} (the builders' output): any attribute at all is a problem. */
export function allowlistCheck(html, opts = {}) {
  const problems = [];
  if (html == null || html === '') return problems;
  if (typeof html !== 'string') return [`not a string: ${typeof html}`];
  for (const tok of tokenize(html)) {
    if (tok.t === 'junk') { problems.push(`comment or declaration: ${tok.v.slice(0, 40)}`); continue; }
    if (tok.t === 'text') continue;
    if (tok.t === 'lt') { problems.push('a stray "<" in text'); continue; }
    if (!ALLOW.tags.has(tok.name)) { problems.push(`${DROP.has(tok.name) ? 'forbidden' : 'unknown'} tag <${tok.name}>`); continue; }
    if (tok.t !== 'start') continue;
    for (const a of tok.attrs) {
      if (opts.attrs === false) problems.push(`<${tok.name}> carries ${a.name} (no attributes allowed here)`);
      else if (!attrOk(tok.name, a.name, a.value)) problems.push(`<${tok.name} ${a.name}="${String(a.value).slice(0, 60)}"> not allowed`);
    }
  }
  return problems;
}

/* ---------- plain: the text of some HTML, for titles, truth tests and search ---------- */
export const plain = h => String(h || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
