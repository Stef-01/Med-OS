/* lib/disk.mjs: the one command-line reader, JSON reader and station reader every script uses */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cli, list, readJson, readJsonl, stationFiles, stationsIn } from './lib/disk.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('cli: a flag\'s value or a default, a flag present or not, comma lists', () => {
  const { opt, flag, argv } = cli(['--kind', 'ai, amsa', '--dry-run', '--jobs', '3']);
  assert.equal(opt('--jobs'), '3'); assert.equal(opt('--limit'), undefined); assert.equal(opt('--limit', '5'), '5');
  assert.equal(flag('--dry-run'), true); assert.equal(flag('--close'), false);
  assert.deepEqual(list(opt('--kind')), ['ai', 'amsa']); assert.deepEqual(list(undefined), []); assert.deepEqual(list(' , x,'), ['x']);
  assert.equal(argv.length, 5);
});

test('readJson and readJsonl: a missing file gives the default, blank lines are skipped', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'disk-'));
  assert.deepEqual(readJson(path.join(dir, 'none.json'), { a: 1 }), { a: 1 });
  assert.deepEqual(readJsonl(path.join(dir, 'none.jsonl')), []);
  fs.writeFileSync(path.join(dir, 'r.jsonl'), '{"a":1}\n\n{"a":2}\n');
  assert.deepEqual(readJsonl(path.join(dir, 'r.jsonl')).map(r => r.a), [1, 2]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the stations on disk: every station file but the index', () => {
  const dir = path.join(ROOT, 'public', 'osce'), files = stationFiles(dir);
  assert.ok(files.length > 100 && !files.includes('index.json') && files.every(f => f.endsWith('.json')));
  const st = stationsIn(dir);
  assert.equal(st.length, files.length); assert.ok(st.every(s => s.id));
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const listed = (index.stations || index).length;
  assert.equal(listed, st.length, 'the index lists every station file');
});
