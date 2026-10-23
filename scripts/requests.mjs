#!/usr/bin/env node
/* requests.mjs - the case writer's queue: the cases students asked for in the app, and the pipeline that turns one into a
   formal station.

     node scripts/requests.mjs                          the open requests, newest first (--all: every request)
     node scripts/requests.mjs add [file]               requests copied, shared or exported from the app (a message, a
                                                        request file or a progress file; no file: paste, then Ctrl-D)
     node scripts/requests.mjs show <id>                one request, the brief it becomes and the command that makes it
     node scripts/requests.mjs accept <id> ["note"]     Being written: the student sees it, with your note
     node scripts/requests.mjs make <id> [--no-imaging] [--dry-run]
                                                        generate-station.mjs on the request's brief (written, gated,
                                                        examined, revised, given exam findings and real images); on
                                                        success the station carries the request's id and the request is
                                                        Ready. Then npm test, commit and push as for any station.
     node scripts/requests.mjs decline <id> "reason"    Not made, with the reason

   An id can be cut to any unique start ("r1k3"). The queue is the shared record (when OSCE_SUPABASE_URL and
   OSCE_SUPABASE_KEY, or public/config.js, name the project) and the inbox requests/ (OSCE_REQUESTS_DIR to move it). An
   answer goes back where the request lives: through the shared record the student sees each step; from the inbox they
   see Ready once the station is published. */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { REQ_SETTINGS, REQ_PATIENTS, REQ_STATUS, requestBrief, requestArgs, requestsFrom, requestState } from '../public/js/osce/requests.mjs';
import { KINDS } from '../public/js/osce/core.mjs';
import { projectFrom, remoteRequests, putRemote, inboxRequests, putInbox, mergeQueues, answer } from './lib/requests-store.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), PUB = path.join(ROOT, 'public');
const INBOX = process.env.OSCE_REQUESTS_DIR || path.join(ROOT, 'requests');
const project = projectFrom(process.env, fs.existsSync(path.join(PUB, 'config.js')) ? fs.readFileSync(path.join(PUB, 'config.js'), 'utf8') : '');
const argv = process.argv.slice(2), flags = argv.filter(a => a.startsWith('--')), [cmd = 'list', ...args] = argv.filter(a => !a.startsWith('--'));
const fail = m => { console.error(m); process.exit(2); };

const bankRows = () => { try { return JSON.parse(fs.readFileSync(path.join(PUB, 'osce', 'index.json'), 'utf8')).stations || []; } catch { return []; } };
async function queue() {
  let remote = [];
  if (project) { try { remote = await remoteRequests(project, fetch); } catch (e) { console.error(`the shared record could not be read (${e.message}); the inbox only`); } }
  return mergeQueues(remote, inboxRequests(INBOX));
}
async function find(id) {
  if (!id) fail(`which request? node scripts/requests.mjs ${cmd} <id>`);
  const q = await queue(), hit = q.filter(x => x.req.id.startsWith(id));
  if (!hit.length) fail(`no request ${id}${q.length ? '' : ' (the queue is empty)'}`);
  if (hit.length > 1) fail(`${id} could be ${hit.map(x => x.req.id).join(', ')}`);
  return hit[0];
}
/* the answer goes where the request lives */
async function write(item, req) {
  if (item.from.includes('shared') && project) await putRemote(project, req, fetch);
  if (item.from.includes('inbox')) putInbox(INBOX, req);
  if (!item.from.includes('shared')) console.log('(from the inbox: the student sees Ready once the station is published; other answers reach them only through the shared record)');
}

const ago = ms => { const m = Math.round((Date.now() - ms) / 60000); return m < 60 ? `${m}m ago` : m < 2880 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`; };
const meta = r => [r.setting !== 'any' && REQ_SETTINGS[r.setting].split(':')[0].toLowerCase(), r.specialty, r.patient && REQ_PATIENTS[r.patient],
  r.focus && `focus: ${r.focus.join(', ')}`, r.results && `Part 2: ${r.results.map(k => KINDS[k]).join(', ')}`].filter(Boolean).join(' · ');
const statusOf = r => requestState(r, bankRows());

if (cmd === 'list') {
  const all = flags.includes('--all'), q = (await queue()).filter(x => all || ['new', 'accepted'].includes(statusOf(x.req).status));
  console.log(`${q.length} ${all ? '' : 'open '}request${q.length === 1 ? '' : 's'} · ${project ? 'shared record + ' : ''}inbox ${path.relative(ROOT, INBOX) || INBOX}/`);
  for (const { req: r, from } of q) {
    const s = statusOf(r);
    console.log(`\n${r.id}  ${REQ_STATUS[s.status].padEnd(13)}  ${ago(r.at).padEnd(8)}  ${r.by || ''}${from.length === 1 && from[0] === 'inbox' ? '  [inbox]' : ''}\n  ${r.topic}${meta(r) ? `\n  ${meta(r)}` : ''}${r.notes ? `\n  "${r.notes.replace(/\s*\n\s*/g, ' ')}"` : ''}${s.station ? `\n  station: ${s.station}` : ''}`);
  }
} else if (cmd === 'add') {
  const text = args[0] ? fs.readFileSync(args[0], 'utf8') : fs.readFileSync(0, 'utf8');
  const found = requestsFrom(text);
  if (!found.length) fail('no request in that: paste the whole message the app copied, or give a request or progress file');
  for (const r of found) { putInbox(INBOX, r); console.log(`added ${r.id} · ${r.topic}`); }
} else if (cmd === 'show') {
  const { req: r, from } = await find(args[0]), s = statusOf(r);
  console.log(`${r.id} · ${REQ_STATUS[s.status]}${s.station ? ` (${s.station})` : ''} · ${r.by || 'a student'}, ${new Date(r.at).toISOString().slice(0, 16).replace('T', ' ')} · ${from.join(' + ')}`);
  console.log(`${r.topic}${meta(r) ? `\n${meta(r)}` : ''}${r.notes ? `\nNotes: ${r.notes}` : ''}${r.reply ? `\nYour note: ${r.reply}` : ''}`);
  console.log(`\nbrief: ${JSON.stringify(requestBrief(r), null, 1)}`);
  console.log(`\nmakes it: node scripts/generate-station.mjs ${requestArgs(r).map(a => (/^[\w-]+$/.test(a) ? a : JSON.stringify(a))).join(' ')}`);
} else if (cmd === 'accept' || cmd === 'decline') {
  const item = await find(args[0]), note = args.slice(1).join(' ').trim();
  if (cmd === 'decline' && !note) fail('say why, so the student knows: node scripts/requests.mjs decline <id> "reason"');
  await write(item, answer(item.req, { status: cmd === 'accept' ? 'accepted' : 'declined', ...(note ? { reply: note } : {}) }));   /* a note only when you write one: the status says the rest */
  console.log(`${item.req.id} · ${cmd === 'accept' ? 'Being written' : 'Not made'}${note ? ` · "${note}"` : ''}`);
} else if (cmd === 'make') {
  const item = await find(args[0]), r = item.req, dry = flags.includes('--dry-run');
  const done = statusOf(r);
  if (done.status === 'made' && done.station) fail(`${r.id} is already made: ${done.station}`);
  if (!dry) await write(item, answer(r, { status: 'accepted' }));
  console.log(`making ${r.id} · ${r.topic}\n`);
  const run = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'generate-station.mjs'), ...requestArgs(r), ...flags.filter(f => f === '--no-imaging' || f === '--dry-run')], { stdio: 'inherit' });
  if (run.status !== 0) { console.log(`\n${r.id} stays Being written: fix the draft and run make again, or decline it with a reason`); process.exit(run.status || 1); }
  if (dry) process.exit(0);
  const dir = path.join(PUB, 'osce'), made = fs.readdirSync(dir).filter(f => f.startsWith('ai-')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))).find(s => s.request?.id === r.id);
  if (!made) fail(`the generator finished but no station carries ${r.id}`);
  await write(item, answer(r, { status: 'made', station: made.id, reply: `Ready: ${made.title}` }));
  console.log(`\n${r.id} · Ready · ${made.id} · ${made.title}\nnext: npm test, then commit and push; the student sees it once the site updates`);
} else fail(`unknown command ${cmd}: list, add, show, accept, make, decline`);
