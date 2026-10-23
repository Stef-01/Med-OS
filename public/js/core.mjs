/* core.mjs - the one HTML escape every view uses on plain text before it goes into markup (XSS-safe). */
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
