/* imaging/image-size.mjs - pure: an image's type and pixel size from its first bytes (PNG, JPEG, GIF, WebP), so a
   downloaded file is checked and its width/height recorded with no image library. -> {mime, width, height} or null. */
export function imageSize(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf || []);
  const u16be = i => (b[i] << 8) | b[i + 1], u32be = i => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const u16le = i => b[i] | (b[i + 1] << 8), u24le = i => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
  if (b.length >= 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { mime: 'image/png', width: u32be(16), height: u32be(20) };
  if (b.length >= 10 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { mime: 'image/gif', width: u16le(6), height: u16le(8) };
  if (b.length >= 30 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    const kind = String.fromCharCode(b[12], b[13], b[14], b[15]);
    if (kind === 'VP8X') return { mime: 'image/webp', width: u24le(24) + 1, height: u24le(27) + 1 };
    if (kind === 'VP8 ') return { mime: 'image/webp', width: u16le(26) & 0x3fff, height: u16le(28) & 0x3fff };
    if (kind === 'VP8L') { const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24); return { mime: 'image/webp', width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
    return null;
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7) || m === 0xff) { i += m === 0xff ? 1 : 2; continue; }
      const len = u16be(i + 2);
      if ((m >= 0xc0 && m <= 0xcf) && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { mime: 'image/jpeg', width: u16be(i + 7), height: u16be(i + 5) };
      i += 2 + len;
    }
    return null;
  }
  return null;
}
export const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' };
