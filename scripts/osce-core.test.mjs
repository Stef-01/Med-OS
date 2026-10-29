/* the OSCE laws this repo added or changed: partner mode, the progress-file merge, the save migration, the source
   vocabulary, the station gate over the shipped bank */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { oscePeople, osceName, osceNextCand, osceWho, osceAttBy, osceCounts, osceMergeImport, osceMigrate, osceOrigin, osceStations, osceIndexRows, osceBody, osceCleanStation, osceLeaves, osceScore, ORIGINS } from '../public/js/osce/core.mjs';
import { sourceTag, specialtyEmoji, disciplineOf } from '../public/js/study-kit/vocab.mjs';

const PUB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

test('names: trimmed, capped, two slots, Partner A / B when empty', () => {
  assert.deepEqual(oscePeople(['  Alex  ', 'Sam'.repeat(20)]), ['Alex', 'SamSamSamSamSamSamSamSam']);
  assert.deepEqual(oscePeople('nope'), ['', '']);
  assert.deepEqual(oscePeople([5, null]), ['', '']);
  assert.equal(osceName(['', 'Sam'], 0), 'Partner A');
  assert.equal(osceName(['', 'Sam'], 1), 'Sam');
});

test('the next candidate alternates when asked to, stays otherwise', () => {
  assert.equal(osceNextCand(0, true), 1);
  assert.equal(osceNextCand(1, true), 0);
  assert.equal(osceNextCand(1, false), 1);
  assert.equal(osceNextCand(undefined, false), 0);
});

test('who did what: per person, unassigned attempts counted apart, unfinished ignored', () => {
  const hist = { s1: [{ id: 'a', who: 0, fin: 1 }, { id: 'b', who: 1, fin: 2 }], s2: [{ id: 'c', who: 1, fin: 3 }], s3: [{ id: 'd', fin: 4 }], s4: [{ id: 'e', who: 0, fin: null }] };
  assert.equal(osceWho({ who: 1 }), 1);
  assert.equal(osceWho({ who: 'x' }), null);
  assert.deepEqual(osceAttBy(hist, 0), { s1: 1 });
  assert.deepEqual(osceAttBy(hist, 1), { s1: 1, s2: 1 });
  assert.deepEqual(osceAttBy(hist, null), { s1: 1, s2: 1, s3: 1 });
  assert.deepEqual(osceCounts(hist), [1, 2, 1]);
});

test('a progress file merges by attempt id and never mutates the record it merges into', () => {
  const mine = { hist: { s1: [{ id: 'a', sid: 's1', at: 1, fin: 2, ticks: ['1'] }] }, bm: { s1: 1 }, people: ['Alex', ''] };
  const before = JSON.stringify(mine);
  const file = { kind: 'osce-progress', people: ['Zed', 'Sam'], bm: { s2: 1 },
    hist: { s1: [{ id: 'a', at: 1, fin: 2, ticks: ['1', '2'], ai: { status: 'done', result: { items: [] } } }, { id: 'b', at: 3, fin: 4, ticks: [] }], s2: [{ id: 'c', at: 5, fin: null }, { id: 'x' }, 'junk'] } };
  const { mem, added } = osceMergeImport(mine, file);
  assert.equal(JSON.stringify(mine), before);
  assert.equal(added, 1);
  assert.deepEqual(mem.hist.s1.map(a => a.id), ['a', 'b']);
  assert.deepEqual(mem.hist.s1[0].ticks, ['1', '2'], 'the AI-marked copy wins');
  assert.equal(mem.hist.s2, undefined, 'unfinished and malformed attempts are skipped');
  assert.deepEqual(mem.bm, { s1: 1, s2: 1 });
  assert.deepEqual(mem.people, ['Alex', 'Sam'], 'names fill only the empty slots');
});

test('the save migration gives partner mode its defaults and keeps a broken store opening', () => {
  const m = osceMigrate({ v: 2, hist: { s1: 'junk', s2: [{ id: 'a', ticks: 'x', ai: 'y' }] }, people: ['Alex'], sess: { queue: ['s1'], cand: 7 } }, 1000);
  assert.deepEqual(m.people, ['Alex', '']);
  assert.equal(m.sess.cand, 0);
  assert.equal(m.alt, true);
  assert.equal(m.hist.s1, undefined);
  assert.deepEqual(m.hist.s2[0].ticks, []);
  assert.deepEqual(osceMigrate({ v: 2, alt: false, sess: { queue: [], cand: 1 } }, 1).sess.cand, 1);
  assert.equal(osceMigrate({ v: 2, alt: false }, 1).alt, false);
});

test('sources: AI generated or written by you, one tag each', () => {
  assert.equal(osceOrigin({ origin: 'ai' }), 'ai');
  assert.equal(osceOrigin({}), 'own');
  assert.deepEqual(ORIGINS.map(o => o[0]), ['ai', 'own']);
  assert.match(sourceTag('ai', 'AI generated: croup'), /kit-src--ai[^>]*title="AI generated: croup">AI</);
  assert.match(sourceTag('own'), /kit-src--own[^>]*>Own</);
  assert.equal(specialtyEmoji('Paediatrics'), '👶');
  assert.equal(specialtyEmoji('Nope'), '');
  assert.equal(disciplineOf('Obstetrics'), 'og');
});

test('the shipped bank: every index row has its body, every body passes the station gate, the rubric is intact', () => {
  const index = JSON.parse(fs.readFileSync(path.join(PUB, 'osce', 'index.json'), 'utf8'));
  const rows = osceStations(osceIndexRows(index), null);
  assert.equal(rows.length, fs.readdirSync(path.join(PUB, 'osce')).filter(f => f.endsWith('.json') && f !== 'index.json').length, 'one index row per station body');
  assert.ok(rows.length >= 26);
  for (const r of rows) {
    const body = JSON.parse(fs.readFileSync(path.join(PUB, 'osce', `${r.id}.json`), 'utf8'));
    const full = osceBody(r, body);
    assert.ok(full, `${r.id} body matches its row`);
    assert.equal(osceOrigin(full), 'ai');
    assert.ok(osceCleanStation(body).check.length > 5);
    const leaves = osceLeaves(full.check);
    assert.ok(leaves.length >= 15, `${r.id} has ${leaves.length} marking items`);
    assert.ok(leaves.some(l => l.crit), `${r.id} has Critical items`);
    assert.equal(osceScore(full.check, leaves.map(l => l.key)).got, leaves.length);
    assert.ok(full.patient.length > 1000, `${r.id} has a patient script`);
  }
});

import { osceStart, osceTick, osceNext, osceLeft, osceFinished, osceResume, oscePause, phasesOf, nextPhase, DEFAULT_TIMING, oscePart2, hasPart2, osceP2Start } from '../public/js/osce/core.mjs';

test('where Part 2 starts on a checklist: the first Interpretation, Management or Safety netting heading', () => {
  const h = (id, x) => ({ id, t: 'heading', x });
  assert.equal(osceP2Start([h(1, 'Professionalism'), { id: 2, x: 'Washes hands' }, h(3, 'History'), h(9, 'Examination: primary survey'), h(13, '<b>Interpretation</b>'), h(20, 'Management')]), 13);
  assert.equal(osceP2Start([h(1, 'History'), h(5, 'Management and safety-netting')]), 5, 'no Interpretation heading: Management starts Part 2');
  assert.equal(osceP2Start([h(1, 'History'), { id: 2, x: 'Interprets the ECG' }]), null, 'an item is not a heading');
  assert.equal(osceP2Start(null), null);
});

test('the clock: 5 minutes reading, 10 of history and examination, 5 of interpretation and management', () => {
  const T = DEFAULT_TIMING;
  assert.deepEqual(T, { reading: 5, station: 10, mx: 5 });
  assert.deepEqual(phasesOf(T), ['reading', 'station', 'mx']);
  let t = osceStart(T, 0);
  assert.deepEqual(t, { c: 'reading', left: 300, at: 0 });
  t = osceTick(t, T, 300_000);
  assert.deepEqual(t, { c: 'station', left: 600, at: 300_000 });
  t = osceTick(t, T, 905_000);   /* Part 1 ran out 5 s ago while the tab was hidden: Part 2 started then */
  assert.deepEqual([t.c, osceLeft(t, 905_000)], ['mx', 295]);
  t = osceTick(t, T, 1_200_000);
  assert.ok(osceFinished(t));
  assert.equal(osceResume(t, 1), t, 'a finished clock cannot be resumed');
});

test('skip moves one phase at a time; Part 2 at 0 runs without it; a paused clock stays paused', () => {
  const T = DEFAULT_TIMING;
  let t = osceNext(osceStart(T, 0), T, 10);
  assert.deepEqual(t, { c: 'station', left: 600, at: 10 });
  t = osceNext(t, T, 20);
  assert.deepEqual(t, { c: 'mx', left: 300, at: 20 });
  assert.ok(osceFinished(osceNext(t, T, 30)));
  const two = { ...T, mx: 0 };
  assert.deepEqual(phasesOf(two), ['reading', 'station']);
  assert.equal(nextPhase('station', two), null);
  assert.ok(osceFinished(osceNext({ c: 'station', left: 100, at: 0 }, two, 5)));
  const p = oscePause({ c: 'station', left: 600, at: 0 }, 60_000);
  assert.deepEqual(p, { c: 'station', left: 540, at: null });
  assert.ok(!osceFinished(p));
  assert.equal(osceTick(p, T, 10_000_000), p, 'paused time does not run');
});

test('timing: the old 2 + 8 default moves to 5 / 10 / 5; chosen times stay; a station finished under the old clock stays finished', () => {
  assert.deepEqual(osceMigrate({ v: 2, timing: { reading: 2, station: 8 } }, 1).timing, DEFAULT_TIMING);
  assert.deepEqual(osceMigrate({ v: 2, timing: { reading: 3, station: 9 } }, 1).timing, { reading: 3, station: 9, mx: 5 });
  assert.deepEqual(osceMigrate({ v: 2, tv: 3, timing: { reading: 5, station: 10, mx: 0 } }, 1).timing, { reading: 5, station: 10, mx: 0 });
  const m = osceMigrate({ v: 2, sess: { queue: ['a'], idx: 0, timer: { c: 'station', left: 0, at: null } } }, 1);
  assert.ok(osceFinished(m.sess.timer));
});

test('Part 2: results with a label and a result, questions in order, anything malformed dropped', () => {
  const p = oscePart2({ lead: ' Here are the bloods. ', handover: [{ label: 'FBC', result: '<p>Hb 92</p>' }, { label: '', result: 'x' }, 'junk'], ask: ['What do they show?', '', 7] });
  assert.deepEqual(p, { lead: 'Here are the bloods.', handover: [{ label: 'FBC', result: '<p>Hb 92</p>' }], ask: ['What do they show?'] });
  assert.deepEqual(oscePart2(null), { lead: '', handover: [], ask: [] });
  assert.equal(oscePart2({ patient: ' <p>Asks "Can I go home?"</p> ' }).patient, '<p>Asks "Can I go home?"</p>', 'what the patient says in Part 2 is kept');
  assert.ok(!('patient' in oscePart2({ patient: '  ' })));
  assert.ok(hasPart2({ part2: p }));
  assert.ok(hasPart2({ part2: oscePart2(null), media: { part2: [{}] } }));
  assert.ok(!hasPart2({ part2: oscePart2(null) }));
});

import { qaSlides, qaHtml, p2State, examSlides, provHtml } from '../public/js/osce/session.mjs';
import { ctx } from '../public/js/osce/state.mjs';
import { osceAskLabel, osceP2Steps, osceVitals, osceFrom, osceFilter, osceRunPool, FROM } from '../public/js/osce/core.mjs';

test('Part 2 steps: the results, then each question named the way the examiner asks it', () => {
  assert.equal(osceAskLabel('Give me an ISBAR handover of this patient to the registrar.', 0), 'ISBAR handover');
  assert.equal(osceAskLabel('What is the most likely diagnosis, and what else would you consider?', 1), 'Differentials');
  assert.equal(osceAskLabel('How would you manage her in the next hour?', 2), 'Management');
  assert.equal(osceAskLabel('What would you tell her before she goes home?', 3), 'Follow-up');
  assert.equal(osceAskLabel('What do these results show?', 0), 'Interpretation');
  assert.deepEqual(osceP2Steps({ ask: ['ISBAR?', 'Manage?'] }), [{ k: 'res', label: 'Results' }, { k: 'q', i: 0, label: 'ISBAR handover' }, { k: 'q', i: 1, label: 'Management' }]);
  assert.deepEqual(osceP2Steps(null), [{ k: 'res', label: 'Results' }]);
});

test('vitals on the candidate\'s screen: one row per sign, named by the words before its number', () => {
  assert.deepEqual(osceVitals('HR 112 regular, BP 86/52 mmHg, RR 32/min, SpO2 89% on room air at triage and 93% on 4 L/min oxygen via nasal prongs, Temp 38.9 °C, CRT 4 seconds, GCS 15'),
    [['HR', '112 regular'], ['BP', '86/52 mmHg'], ['RR', '32/min'], ['SpO2', '89% on room air at triage and 93% on 4 L/min oxygen via nasal prongs'], ['Temp', '38.9 °C'], ['CRT', '4 seconds'], ['GCS', '15']]);
  assert.deepEqual(osceVitals('BGL 5.4 mmol/L, weight 78 kg'), [['BGL', '5.4 mmol/L'], ['Weight', '78 kg']], 'a lower-case sign with a number starts a row too');
  assert.deepEqual(osceVitals('SpO2 98% on room air, settling'), [['SpO2', '98% on room air, settling']]);
  assert.deepEqual(osceVitals('Alert and talking'), [['', 'Alert and talking']]);
  assert.deepEqual(osceVitals('HR 82 beats/min regular; BP 148/92 mmHg; RR 16/min; SpO2 96% on room air; temperature 36.6 °C'),
    [['HR', '82 beats/min regular'], ['BP', '148/92 mmHg'], ['RR', '16/min'], ['SpO2', '96% on room air'], ['Temperature', '36.6 °C']], 'semicolons part the signs too');
  assert.deepEqual(osceVitals('10:20, seated at rest on room air: HR 68 beats/min, regular; BP 122/74 mmHg'),
    [['', '10:20, seated at rest on room air'], ['HR', '68 beats/min, regular'], ['BP', '122/74 mmHg']], 'when and how they were taken is a row of its own');
  assert.deepEqual(osceVitals('GCS 15: alert'), [['GCS', '15: alert']], 'a colon after the number stays in the value');
  assert.deepEqual(osceVitals('Temperature 37.1 C. The monitor shows a slow fetal heart rate; the CTG is handed over in Part 2.'),
    [['Temperature', '37.1 C. The monitor shows a slow fetal heart rate; the CTG is handed over in Part 2.']], 'a semicolon in a sentence does not part it');
  assert.deepEqual(osceVitals('Pain 7/10 (triage 20 minutes ago: RR 24/min, SpO2 93% RA)'), [['Pain', '7/10 (triage 20 minutes ago: RR 24/min'], ['SpO2', '93% RA)']], 'a colon after a sign leaves it whole');
  assert.deepEqual(osceVitals('Temperature 37.8 °C, alert (14:40 set; the 08:00 set was all normal)'), [['Temperature', '37.8 °C, alert (14:40 set; the 08:00 set was all normal)']], 'a semicolon inside brackets is part of the note');
  assert.deepEqual(osceVitals(''), []);
  const sl = examSlides({ vitals: 'HR 108, BP 114/72', bedside: [{ test: 'BGL', find: '5.6 mmol/L' }], steps: [{ area: 'Abdomen', find: 'Guarding' }] });
  assert.deepEqual(sl.map(x => x.label), ['Vital signs', 'Bedside tests']);
  assert.match(sl[0].html, /<dt>HR<\/dt><dd>108<\/dd>/);
  assert.match(sl[1].html, /<th>BGL<\/th><td>5.6 mmol\/L<\/td>/);
  assert.doesNotMatch(sl.map(x => x.html).join(''), /Guarding/, 'the examination findings stay with the examiner');
  assert.deepEqual(examSlides({ steps: [] }), []);
});

test('AMSA cases: tagged by their source, filterable, searchable, with a provenance note; never a category of their own', () => {
  const amsa = { id: 'amsa-1', title: 'Chest pain 1', origin: 'ai', specialty: ['Cardiology'], source: { label: 'AMSA MedEd OSCEs', url: 'https://amsameded.org.au/resources/mod/resource/view.php?id=1', title: 'Chest Pain 1' } };
  const ai = { id: 'ai-1', title: 'Chest pain 2', origin: 'ai', specialty: ['Cardiology'] }, own = { id: '3', title: 'Chest pain 3', specialty: ['Cardiology'] };
  assert.equal(osceFrom(amsa), 'amsa');
  assert.equal(osceFrom(ai), '');
  assert.deepEqual(FROM, [['amsa', 'From AMSA MedEd']]);
  assert.deepEqual(osceFilter([amsa, ai, own], '', { origin: ['amsa'] }).map(s => s.id), ['amsa-1']);
  assert.deepEqual(osceFilter([amsa, ai, own], '', { origin: ['amsa', 'own'] }).map(s => s.id), ['amsa-1', '3']);
  assert.deepEqual(osceFilter([amsa, ai, own], '', { origin: ['ai'] }).map(s => s.id), ['amsa-1', 'ai-1'], 'an AMSA case is still AI generated');
  assert.deepEqual(osceFilter([amsa, ai, own], 'amsa').map(s => s.id), ['amsa-1'], 'a search for AMSA finds them');
  assert.deepEqual(osceRunPool([amsa, ai, own], { specs: ['Cardiology'], origin: ['amsa'] }).map(s => s.id), ['amsa-1']);
  assert.match(provHtml(amsa), /Case from the AMSA MedEd OSCE library: <a href="https:\/\/amsameded.org.au\/resources\/mod\/resource\/view.php\?id=1" target="_blank" rel="noopener noreferrer">Chest Pain 1<\/a>\./);
  assert.equal(provHtml(ai), '');
});

test('Part 2 slides: each result, then each image labelled by its alt text; the examiner\'s caption never reaches the candidate', () => {
  const st = { id: 's1', part2: oscePart2({ lead: 'Say this', handover: [{ label: 'Bloods', result: '<p>Hb 92</p>' }], ask: ['What do they show?', 'Management?'], expect: ['<p>Low Hb</p>', ''] }),
    media: { part2: [{ src: 'media/s1/cxr-1.png', alt: 'Frontal chest radiograph', caption: 'Chest X-ray: show when asked', credit: { author: 'A', license: 'CC BY 4.0', page: 'https://commons.wikimedia.org/x' } }] } };
  const slides = qaSlides(st);
  assert.deepEqual(slides.map(x => x.label), ['Bloods', 'Frontal chest radiograph']);
  assert.match(slides[0].html, /Hb 92/);
  assert.match(slides[1].html, /<img src=".\/media\/s1\/cxr-1.png"/);
  assert.doesNotMatch(slides[1].html, /show when asked/);
  assert.match(slides[1].html, /CC BY 4.0/, 'the licence credit stays with the image');
  const html = qaHtml(st);
  assert.match(html, /data-os="present" data-sid="s1" data-i="0"/);
  assert.equal((html.match(/data-os="present"/g) || []).length, 3, 'Turn the screen plus one pop-out per result');
  assert.deepEqual([...html.matchAll(/data-os="p2step" data-sid="s1" data-n="(\d)"(?: aria-current="step")?><b>[^<]*<\/b><span>([^<]+)/g)].map(m => m[2]), ['Results', 'Interpretation', 'Management'], 'a step for the results, then one per question');
  assert.match(html, /data-n="0" aria-current="step"/, 'Part 2 opens on the results');
  assert.doesNotMatch(html, /Expected answer/, 'the results step shows no question yet');
  assert.match(html, /data-os="p2step" data-sid="s1" data-n="1"><span>Ask the first question<\/span>/);
  p2State('s1').n = 2;   /* the examiner has moved on to the second question */
  const q2 = qaHtml(st);
  assert.match(q2, /Question 2 of 2 · Management<\/small><p class="os-qaq">“Management\?”<\/p>/);
  assert.doesNotMatch(q2, /What do they show/, 'one question at a time');
  assert.match(q2, /class="os-p2chip" data-os="present" data-sid="s1" data-i="0" data-q="1">/, 'a chip turns the screen to any result, with the question');
  assert.equal((q2.match(/class="os-p2chip[ "]/g) || []).length, 2, 'a chip per result, the image included');
  assert.match(q2, /data-n="1">.*<span>Back<\/span>/s, 'Back goes to the first question');
  p2State('s1').seen.add(0);
  assert.match(qaHtml(st), /class="os-p2chip seen" data-os="present" data-sid="s1" data-i="0"/, 'a result the candidate has seen carries a tick');
  ctx.mem = { p2flat: true };
  const flat = qaHtml(st);
  assert.match(flat, /Examiner questions<\/h4><ol><li><p class="os-qaq">“What do they show\?”<\/p><div class="os-qaexp"><small>Expected answer<\/small><div class="os-html"><p>Low Hb<\/p><\/div><\/div><\/li><li><p class="os-qaq">“Management\?”<\/p><\/li><\/ol>/);
  assert.ok(flat.indexOf('Examiner questions') > flat.indexOf('os-qares'), 'all on one page: the examiner questions come last, after the results');
  assert.doesNotMatch(flat, /os-p2steps/);
  ctx.mem = undefined;
  assert.equal(qaHtml({ id: 'x', part2: oscePart2(null) }), '');
});

import { contentTabs, tabBody, markingHtml } from '../public/js/osce/session.mjs';
test('the Patient Script tab runs in the order of the clock: the history, the exam findings, then Part 2; the marking sheet keeps to the marking', () => {
  ctx.exam = { s3: { vitals: 'HR 118', steps: [{ area: 'Abdomen', find: 'Guarding' }] } };
  const st = { id: 's3', patient: '<p>HISTORY</p>', tasks: [], points: [], refs: [],
    check: [{ id: 1, t: 'heading', x: 'History' }, { id: 2, x: 'Takes a history' }, { id: 3, t: 'heading', x: 'Interpretation' }, { id: 4, x: 'Reads the Hb' }],
    part2: oscePart2({ lead: 'Say this', handover: [{ label: 'Bloods', result: '<p>Hb 92</p>' }], ask: ['What do they show?'], patient: '<p>Asks "Am I going to die?"</p>' }) };
  assert.deepEqual(contentTabs(st), ['Instructions', 'Patient Script'], 'no separate Exam tab');
  const h = tabBody(st, null, 'Patient Script');
  assert.match(h, /^<nav class="os-jump" aria-label="Jump to"><button data-os="jump" data-to="hx" aria-current="true">History<\/button><button data-os="jump" data-to="ex">Exam<\/button><button data-os="jump" data-to="p2">Part 2<\/button><\/nav>/, 'a jump bar for the three parts');
  const at = x => h.indexOf(x);
  assert.ok(at('HISTORY') > 0 && at('HISTORY') < at('class="os-exam"') && at('class="os-exam"') < at('class="os-part2"'), 'history, then exam findings, then Part 2');
  assert.ok(at('<h4>Ask</h4>') < at('As the patient') && at('As the patient') < at('data-os="markp2"') && at('data-os="markp2"') < at('<h4>Results</h4>'), 'Part 2: ask, what the patient says, Mark Part 2, then the results');
  assert.match(h, /As the patient<\/small><div class="os-html"><p>Asks "Am I going to die\?"<\/p><\/div>/);
  const kept = tabBody(st, { hl: { 'Patient Script': '<h2>Patient Script</h2><div class="os-html"><p><mark>HISTORY</mark></p></div>' } }, 'Patient Script');
  assert.match(kept, /<\/nav><div class="os-sheet" data-hl="Patient Script"><h2>Patient Script<\/h2><div class="os-html"><p><mark>HISTORY<\/mark><\/p><\/div><\/div><section class="os-exam"/, 'a highlight keeps the history only; the findings and results render fresh after it');
  const marking = markingHtml(st, null, false);
  assert.match(marking, /Takes a history/);
  assert.match(marking, /<h3>History<\/h3>.*<h3 class="os-h-p2">Interpretation<\/h3>/s, 'Part 2 starts at Interpretation on the marking sheet');
  assert.doesNotMatch(marking, /os-part2|os-exam/);
  ctx.exam = {};
  assert.doesNotMatch(tabBody({ ...st, part2: oscePart2(null) }, null, 'Patient Script'), /os-jump/, 'one part: no jump bar');
  assert.deepEqual(contentTabs({ id: 'x', patient: '', part2: oscePart2(null) }), ['Instructions'], 'nothing for the examiner, no tab');
});

import { ddxHtml } from '../public/js/osce/session.mjs';
import { osceDdx, DDX_TIERS } from '../public/js/osce/core.mjs';
test('reasonable differentials: the leading diagnosis first, malformed rows dropped, shown in the script and at the differentials question', () => {
  const raw = [{ dx: 'Mesenteric ischaemia', tier: 'dangerous', for: 'Ex-smoker', against: 'Normal lactate' }, { dx: '', tier: 'reasonable' }, { dx: 'Toxic megacolon', tier: 'weird' },
    { dx: 'Adhesive small bowel obstruction', tier: 'likely', for: 'CT transition point', against: '' }, { dx: 'Large bowel obstruction', tier: 'reasonable', for: '', against: 'Collapsed colon' }];
  const dd = osceDdx(raw);
  assert.deepEqual(dd.map(d => d.tier), ['likely', 'reasonable', 'dangerous']);
  assert.deepEqual(osceDdx('x'), []);
  assert.equal(DDX_TIERS.dangerous, 'Must not miss');
  const st = { id: 's9', ddx: dd, patient: '<p>HISTORY</p>', tasks: [], check: [], part2: oscePart2({ handover: [{ label: 'CT', result: '<p>SBO</p>' }], ask: ['Give an ISBAR handover.', 'What is your most likely diagnosis, and what else would you consider?', 'How would you manage her?'] }) };
  const card = ddxHtml(st);
  assert.match(card, /<strong id="os-ddx-h">Reasonable differentials<\/strong>/);
  assert.match(card, /os-dd--likely"><div class="os-ddtop"><small class="os-ddtier">Most likely<\/small><strong>Adhesive small bowel obstruction<\/strong><\/div><p><b>For<\/b> CT transition point<\/p><\/li>/, 'an empty against line is left out');
  assert.match(card, /Must not miss<\/small><strong>Mesenteric ischaemia/);
  assert.equal(ddxHtml({ id: 'x' }), '');
  const h = tabBody(st, null, 'Patient Script');
  assert.match(h, /data-to="dd">Differentials<\/button>/, 'the jump bar has the differentials');
  assert.ok(h.indexOf('class="os-ddx"') > h.indexOf('HISTORY') && h.indexOf('class="os-ddx"') < h.indexOf('class="os-part2"'), 'after the history and exam, before Part 2');
  p2State('s9').n = 2;
  const q = qaHtml(st);
  assert.match(q, /Question 2 of 3 · Differentials<\/small><p class="os-qaq">[^<]*<\/p><div class="os-ddx os-ddx--compact">/, 'the differentials question carries the list');
  assert.doesNotMatch(q, /<b>For<\/b>/, 'compact: names and tiers only');
  p2State('s9').n = 3;
  assert.doesNotMatch(qaHtml(st), /os-ddx/, 'not on the management question');
});

/* ---- games and the account (founder 2026-10-25) ---- */
import { GAMES, osceGames } from '../public/js/osce/core.mjs';
import * as acct from '../public/js/osce/account.mjs';
import * as duelAcct from '../public/js/vendor/pup-duel/duel/accounts.mjs';

test('games: Duel a Mate is on and the Study buddy off until switched, and only a boolean switches', () => {
  assert.deepEqual(osceGames({}), { duel: true, mascot: false });
  assert.deepEqual(osceGames(null), { duel: true, mascot: false });
  assert.deepEqual(osceGames({ games: { duel: 'no', mascot: 'yes' } }), { duel: true, mascot: false });
  assert.deepEqual(osceGames({ games: { duel: false, mascot: true } }), { duel: false, mascot: true });
  assert.ok(GAMES.every(g => g.id && g.name && g.line));
});

test('the account takes the same names and PINs as the duel (its own rules, re-exported)', () => {
  assert.equal(acct.nameError, duelAcct.nameError); assert.equal(acct.pinError, duelAcct.pinError);
  assert.equal(acct.NAME_RE.source, duelAcct.NAME_RE.source);
  assert.equal(acct.PIN_RE.source, duelAcct.PIN_RE.source);
  for (const n of ['Sam', 'S', '  Sam  Lee ', 'a'.repeat(21), 'Zoë', '__', 'Dr. K-9']) assert.equal(acct.nameError(n), duelAcct.nameError(n), n);
  for (const p of ['1234', '123', '12a4', '', '12345']) assert.equal(acct.pinError(p), duelAcct.pinError(p), p);
});
