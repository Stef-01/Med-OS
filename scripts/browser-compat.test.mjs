/* the site's own browser modules parse on every phone it serves: no syntax an older Safari rejects at load. A regex
   lookbehind, (?<= or (?<!, is a SyntaxError before Safari 16.4 (iOS 16.4, March 2023; an iPhone 7 stops at iOS 15),
   and a module that fails to parse takes every module importing it down with it (2026-10-27: three were in use, one in
   the station flow). Vendored packages are their owners' to fix. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const JS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'js');
const files = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? (e.name === 'vendor' ? [] : files(path.join(dir, e.name))) : /\.m?js$/.test(e.name) ? [path.join(dir, e.name)] : []));

test('no regex lookbehind in the site\'s own browser modules', () => {
  const hits = files(JS).flatMap(f => fs.readFileSync(f, 'utf8').split('\n').map((l, i) => (/\(\?<[=!]/.test(l) ? `${path.relative(JS, f)}:${i + 1}` : null)).filter(Boolean));
  assert.deepEqual(hits, []);
});
