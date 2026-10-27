/* lib/disk.mjs - what every script reads the same way: the command line, JSON and JSON Lines files, and the stations on
   disk. One copy of each, so a change to how a flag reads or where stations live is made once (REA's function
   fingerprints over scripts/ found the option reader in 9 scripts, the station reader in 7, 2026-10-27). */
import fs from 'node:fs';
import path from 'node:path';

/* the command line: opt('--n', d) the value after a flag (d when absent), flag('--x') whether it is there, list(v) a
   comma list as trimmed, non-empty strings */
export const list = v => (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : []);
export function cli(argv = process.argv.slice(2)) {
  const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  return { argv, opt, flag: k => argv.includes(k), list };
}

export const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d);
export const readJsonl = f => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l)) : []);

/* the station files in public/osce (every .json but the index), and the stations in them */
export const isStationFile = f => f.endsWith('.json') && f !== 'index.json';
export const stationFiles = dir => fs.readdirSync(dir).filter(isStationFile);
export const stationsIn = dir => stationFiles(dir).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
