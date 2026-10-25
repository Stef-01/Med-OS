/* case requests: what a student asks for, the brief the generator gets, the message that carries it with no shared
   database, where a request stands, the writer's queue (shared record and inbox) and the writer's commands */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cleanRequest, newRequestId, requestBrief, requestArgs, requestText, requestsFrom, requestState, newerRequest } from '../public/js/osce/requests.mjs';
import { readConfig, projectFrom, remoteRequests, putRemote, inboxRequests, putInbox, mergeQueues, answer } from './lib/requests-store.mjs';
import { shardsOf, SPEC } from '../public/js/study-kit/sync.mjs';
import { osceMergeImport, osceMigrate } from '../public/js/osce/core.mjs';
import { stationRow } from './build-index.mjs';
import { shapeProblems } from './lib/station-gates.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const AT = Date.UTC(2026, 9, 23, 8, 30);
const REQ = { id: 'rmgz1k2ab3c', topic: '  chest pain in a  58-year-old smoker ', setting: 'acute', specialty: 'Cardiology', patient: 'adult',
  focus: ['History', 'Interpretation', 'Juggling'], results: ['ecg', 'bloods', 'ecg', 'tarot'], notes: 'Practise the HEART score.\nExam on 12 Nov.', by: 'Alex', at: AT, status: 'new' };

test('a request is cleaned to what the pipeline can use; anything unknown drops, a request with no topic is refused', () => {
  const r = cleanRequest(REQ);
  assert.deepEqual(r, { id: 'rmgz1k2ab3c', topic: 'chest pain in a 58-year-old smoker', setting: 'acute', at: AT, status: 'new', specialty: 'Cardiology', patient: 'adult',
    focus: ['History', 'Interpretation'], results: ['ecg', 'bloods'], notes: 'Practise the HEART score.\nExam on 12 Nov.', by: 'Alex' });
  assert.equal(cleanRequest({ ...REQ, topic: 'cp' }), null, 'a topic of a few words at least');
  assert.equal(cleanRequest({ ...REQ, id: 'x1' }), null);
  assert.equal(cleanRequest({ ...REQ, at: 0 }), null);
  assert.equal(cleanRequest({ ...REQ, setting: 'moon', status: 'hacked', patient: 'alien' }).setting, 'any');
  assert.equal(cleanRequest({ ...REQ, status: 'hacked' }).status, 'new');
  assert.equal(cleanRequest({ ...REQ, topic: 'x'.repeat(500) }).topic.length, 200);
  assert.equal(cleanRequest(null), null);
  assert.match(newRequestId(AT, () => 0.5), /^r[a-z0-9]{6,24}$/);
  assert.notEqual(newRequestId(AT, () => 0.1), newRequestId(AT, () => 0.9));
});

test('the brief: an acute station with its specialty and types, and notes that carry the patient, the results and the student\'s words', () => {
  assert.deepEqual(requestBrief(REQ), { topic: 'chest pain in a 58-year-old smoker', acute: true, specialty: ['Cardiology'], types: ['History', 'Interpretation'],
    notes: 'Patient: adult. Part 2 results to include: ECG, Bloods. From the student who asked for it: Practise the HEART score. Exam on 12 Nov.' });
  assert.deepEqual(requestArgs(REQ), ['chest pain in a 58-year-old smoker', '--acute', '--specialty', 'Cardiology', '--type', 'History, Interpretation',
    '--notes', 'Patient: adult. Part 2 results to include: ECG, Bloods. From the student who asked for it: Practise the HEART score. Exam on 12 Nov.', '--request', 'rmgz1k2ab3c']);
  const clinic = { id: 'rmgz1k2ab3d', topic: 'new type 1 diabetes, explaining to a parent', setting: 'clinic', at: AT };
  assert.deepEqual(requestArgs(clinic), ['new type 1 diabetes, explaining to a parent', '--notes', 'Setting: a clinic (GP or outpatients).', '--request', 'rmgz1k2ab3d']);
  assert.deepEqual(requestArgs({ id: 'rmgz1k2ab3e', topic: 'syncope in a teenager', at: AT }), ['syncope in a teenager', '--request', 'rmgz1k2ab3e'], 'nothing narrowed: the topic alone');
});

test('with no shared database, the request travels as a message: readable, and found again in whatever was pasted around it', () => {
  const t = requestText(REQ);
  assert.match(t, /^OSCE case request · rmgz1k2ab3c\nCase: chest pain in a 58-year-old smoker\nAcute: ED or ward · Cardiology · Adult\nFocus: History, Interpretation\nPart 2 results: ECG, Bloods\nNotes: Practise the HEART score.\nExam on 12 Nov.\nFrom Alex, 2026-10-23\n\n\{"osceRequest":1,/);
  assert.deepEqual(requestsFrom(`Hi! Could you write this one?\n\n${t}\n\nThanks`), [cleanRequest(REQ)]);
  const two = { ...REQ, id: 'rmgz1k2ab3f', topic: 'acute asthma in a child' };
  assert.deepEqual(requestsFrom(`${t}\n\n${requestText(two)}`).map(r => r.id), ['rmgz1k2ab3c', 'rmgz1k2ab3f']);
  assert.deepEqual(requestsFrom(JSON.stringify({ kind: 'osce-progress', req: { [two.id]: two } })).map(r => r.id), ['rmgz1k2ab3f'], 'an exported progress file');
  assert.deepEqual(requestsFrom(JSON.stringify([REQ, { ...REQ, status: 'accepted', updated: AT + 9 }])).map(r => r.status), ['accepted'], 'the newer copy of one id');
  assert.deepEqual(requestsFrom('just some words'), []);
  assert.deepEqual(requestsFrom(`${t.slice(0, -20)}`), [], 'a message cut short finds nothing rather than a broken request');
});

test('where a request stands: a station in the bank made from it says Ready, from its index row or its loaded body', () => {
  const r = cleanRequest({ ...REQ, status: 'accepted' });
  assert.deepEqual(requestState(r, [{ id: 'ai-1', request: 'rother00' }]), { status: 'accepted', station: '' });
  assert.deepEqual(requestState(r, [{ id: 'ai-9', request: 'rmgz1k2ab3c' }]), { status: 'made', station: 'ai-9' });
  assert.deepEqual(requestState(r, [{ id: 'ai-9', request: { id: 'rmgz1k2ab3c', at: 'x' } }]), { status: 'made', station: 'ai-9' });
  assert.equal(newerRequest(r, { ...r, status: 'made', updated: AT + 1 }).status, 'made');
});

test('requests ride the shared record: one shard each, kept by the migration, merged from a progress file by the newer copy', () => {
  assert.deepEqual(Object.keys(shardsOf(SPEC.osce, { req: { [REQ.id]: REQ }, hist: {} })), [`req/${REQ.id}`]);
  assert.deepEqual(osceMigrate({ v: 2, req: { [REQ.id]: REQ } }, AT).req, { [REQ.id]: REQ });
  assert.deepEqual(osceMigrate({ v: 2, req: 'junk' }, AT).req, {});
  const mine = { hist: {}, bm: {}, people: ['', ''], req: { [REQ.id]: { ...REQ, status: 'made', updated: AT + 5 } } };
  const file = { req: { [REQ.id]: REQ, rmgz1k2ab3f: { ...REQ, id: 'rmgz1k2ab3f' }, rbad00000: { id: 'other' } } };
  const { mem } = osceMergeImport(mine, file);
  assert.equal(mem.req[REQ.id].status, 'made', 'the writer\'s newer answer is not undone by an older copy');
  assert.ok(mem.req.rmgz1k2ab3f);
  assert.ok(!mem.req.rbad00000, 'an entry filed under another id is left out');
});

test('a station made from a request carries its id: the index row passes it on, and the gates check its shape', () => {
  const st = { id: 'ai-x', title: 'T', request: { id: 'rmgz1k2ab3c', at: '2026-10-23T08:30:00Z' } };
  assert.equal(stationRow(st, 10).request, 'rmgz1k2ab3c');
  assert.ok(!('request' in stationRow({ id: 'ai-y', title: 'T' }, 10)));
  assert.deepEqual(shapeProblems({ check: [], request: { id: 'rmgz1k2ab3c' } }).filter(p => /request/.test(p)), []);
  assert.match(shapeProblems({ check: [], request: 'rmgz1k2ab3c' }).join(), /request: the case request/);
});

test('the writer\'s queue: the project from the environment or config.js, the shared rows read and written, the inbox, both merged', async () => {
  assert.deepEqual(readConfig("window.OSCE_CONFIG = {\n  supabaseUrl: 'https://abc.supabase.co/',\n  supabaseAnonKey: 'pk_1',\n};"), { url: 'https://abc.supabase.co', key: 'pk_1' });
  assert.equal(readConfig("supabaseUrl: '', supabaseAnonKey: ''"), null);
  assert.equal(projectFrom({ OSCE_SUPABASE_URL: 'none' }, "supabaseUrl: 'https://cfg.co', supabaseAnonKey: 'c'"), null);
  assert.deepEqual(projectFrom({ OSCE_SUPABASE_URL: 'https://env.co', OSCE_SUPABASE_KEY: 'k' }, "supabaseUrl: 'https://cfg.co', supabaseAnonKey: 'c'"), { url: 'https://env.co', key: 'k' });
  const calls = [], rows = [{ id: `req/${REQ.id}`, value: REQ, updated_at: 'x' }, { id: 'req/rgone0000', value: null }, { id: 'hist/ai-1', value: { a: 1 } }];
  const fetch = async (url, init = {}) => { calls.push({ url, init }); return { ok: true, status: 200, json: async () => rows }; };
  const p = { url: 'https://abc.supabase.co', key: 'pk_1' };
  assert.deepEqual((await remoteRequests(p, fetch)).map(r => r.id), [REQ.id], 'withdrawn requests and other shards are left out');
  assert.equal(calls[0].url, 'https://abc.supabase.co/rest/v1/osce_state?ns=eq.osce&id=like.req/*&select=id,value,updated_at');
  assert.equal(calls[0].init.headers.apikey, 'pk_1');
  await putRemote(p, answer(cleanRequest(REQ), { status: 'accepted', reply: 'Tonight' }, AT + 60000), fetch, AT + 60000);
  const sent = JSON.parse(calls[1].init.body)[0];
  assert.equal(calls[1].url, 'https://abc.supabase.co/rest/v1/osce_state?on_conflict=ns,id');
  assert.match(calls[1].init.headers.Prefer, /merge-duplicates/);
  assert.deepEqual([sent.ns, sent.id, sent.value.status, sent.value.reply, sent.updated_at], ['osce', `req/${REQ.id}`, 'accepted', 'Tonight', new Date(AT + 60000).toISOString()]);
  await assert.rejects(remoteRequests(p, async () => ({ ok: false, status: 401 })), /401/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-inbox-'));
  putInbox(dir, cleanRequest({ ...REQ, id: 'rmgz1k2ab3f', at: AT + 1 }));
  fs.writeFileSync(path.join(dir, 'rjunk0000.json'), '{nope');
  assert.deepEqual(inboxRequests(dir).map(r => r.id), ['rmgz1k2ab3f']);
  const q = mergeQueues([cleanRequest(REQ)], [cleanRequest({ ...REQ, status: 'accepted', updated: AT + 9 }), ...inboxRequests(dir)]);
  assert.deepEqual(q.map(x => [x.req.id, x.req.status, x.from.join('+')]), [['rmgz1k2ab3f', 'new', 'inbox'], [REQ.id, 'accepted', 'shared+inbox']]);
  assert.deepEqual(answer(cleanRequest(REQ), { status: 'made', station: 'ai-9', reply: 'Ready: T' }, AT + 7), { ...cleanRequest(REQ), status: 'made', station: 'ai-9', reply: 'Ready: T', updated: AT + 7 });
});

test('the writer\'s commands on the inbox: add a pasted message, list, show the command it makes, accept, decline', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'req-cli-')), msg = path.join(dir, 'msg.txt');
  fs.writeFileSync(msg, `Hi, can you write this?\n\n${requestText(REQ)}\n`);
  const env = { ...process.env, OSCE_REQUESTS_DIR: path.join(dir, 'inbox'), OSCE_SUPABASE_URL: 'none', OSCE_SUPABASE_KEY: '' };
  const cli = (...a) => execFileSync(process.execPath, [path.join(ROOT, 'scripts', 'requests.mjs'), ...a], { env, encoding: 'utf8' });
  assert.match(cli('add', msg), /added rmgz1k2ab3c · chest pain in a 58-year-old smoker/);
  assert.match(cli(), /1 open request · inbox .*\n\nrmgz1k2ab3c  Requested .*Alex  \[inbox\]\n  chest pain in a 58-year-old smoker\n  acute · Cardiology · Adult · focus: History, Interpretation · Part 2: ECG, Bloods/);
  assert.match(cli('show', 'rmgz1k'), /makes it: node scripts\/generate-station.mjs "chest pain in a 58-year-old smoker" --acute --specialty Cardiology --type "History, Interpretation" --notes ".*" --request rmgz1k2ab3c/);
  assert.match(cli('accept', 'rmgz', 'Writing it tonight'), /rmgz1k2ab3c · Being written · "Writing it tonight"/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, 'inbox', 'rmgz1k2ab3c.json'), 'utf8')).status, 'accepted');
  assert.throws(() => cli('decline', 'rmgz'), /say why/);
  assert.match(cli('decline', 'rmgz', 'Already in the bank as acute coronary syndrome'), /Not made/);
  assert.match(cli(), /0 open requests/);
  assert.match(cli('--all'), /Not made/);
  assert.throws(() => cli('show', 'rzzz'), /no request rzzz/);
});
