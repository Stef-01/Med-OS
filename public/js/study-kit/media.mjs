/* media.mjs - station images (study kit). Every image a station shows is a local file under public/media/<station>/,
   written by scripts/fetch-imaging.mjs with the licence and author it was published under; the station JSON carries
   both, and the figure prints them under the image (the licences require the credit).

   mediaAttr(src) -> the src attribute for a local path (no scheme, no leading slash, no ..); anything else gives no src.
   figureHtml(m) -> one <figure> for a media entry {src, alt, w, h, caption?, findings?, credit?: {author, license, licenseUrl, page}}:
   the image (a link to the file at full size, for zooming into an ECG on a phone), then the findings, one sentence of
   what the image shows, closed until tapped so the image is read first and labelled AI-written (the reviewer that
   checked the image wrote it), then the caption and the credit */

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const LOCAL_RE = /^(?:\.\/)?[\w-][\w\-./]*$/;
export const isLocal = p => LOCAL_RE.test(String(p || '')) && !String(p).includes('..');
export const localUrl = p => `./${String(p || '').replace(/^\.?\//, '')}`;
export const mediaAttr = src => (isLocal(src) ? ` src="${esc(localUrl(src))}"` : '');
const httpUrl = u => (/^https?:\/\/[^\s"'<>]+$/i.test(String(u || '')) ? String(u) : '');

/* "Author · CC BY-SA 4.0 · source" with each part linked when a link is known; '' when there is no credit */
export function creditHtml(c) {
  if (!c || typeof c !== 'object') return '';
  const link = (text, url) => (httpUrl(url) ? `<a href="${esc(httpUrl(url))}" target="_blank" rel="noreferrer">${esc(text)}</a>` : esc(text));
  const parts = [c.author ? esc(c.author) : '', c.license ? link(c.license, c.licenseUrl) : '', c.page ? link(c.via || 'source', c.page) : ''].filter(Boolean);
  return parts.length ? `<small class="os-credit">${parts.join(' · ')}</small>` : '';
}

export function figureHtml(m) {
  if (!m || !isLocal(m.src)) return '';
  const size = m.w && m.h ? ` width="${+m.w}" height="${+m.h}"` : '';
  const cap = m.caption ? `<span>${esc(m.caption)}</span>` : '';
  const credit = creditHtml(m.credit);
  const findings = m.findings ? `<details class="os-findings"><summary><span>Findings</span><b>AI-written</b></summary><p>${esc(m.findings)}</p></details>` : '';
  return `<figure class="os-fig"><a class="os-figzoom" href="${esc(localUrl(m.src))}" target="_blank" rel="noreferrer" aria-label="Open the image full size"><img${mediaAttr(m.src)} alt="${esc(m.alt || m.caption || '')}" loading="lazy" decoding="async"${size}></a>${findings}${cap || credit ? `<figcaption>${cap}${credit}</figcaption>` : ''}</figure>`;
}
