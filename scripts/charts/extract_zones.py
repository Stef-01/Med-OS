"""Read the NSW Health observation chart PDFs and write the zone spec the app draws and classifies from.

  python3 -I scripts/charts/extract_zones.py chart.pdf                     # print one chart's bands and labels (to check)
  python3 -I scripts/charts/extract_zones.py --spec <folder> public/js/osce/obs-charts.mjs

<folder> holds adult.pdf (SAGO, SMR110.010), p12plus.pdf (SPOC 12+, SMR110.019), p5to11.pdf (SMR110.018), p1to4.pdf
(SMR110.017) and p3to12m.pdf (SMR110.016), as published by the NSW Clinical Excellence Commission. The PDFs are not in
the repo. Needs PyMuPDF (pip install pymupdf). Every band comes from the chart's own fill colour between its own scale
lines, sampled at the quarter points of each band so 5-unit sub-rows are seen; scripts/obs-charts.test.mjs checks the
result against the threshold tables printed on the charts and the NSW CERS criteria."""
import sys, re, json, statistics, pymupdf

def zone(c):
    r, g, b = c
    if r > 0.9 and g < 0.8 and b < 0.72: return 'red'
    if r > 0.95 and g > 0.8 and b < 0.4: return 'yellow'
    if b > 0.9 and g > 0.9 and b - r > 0.05: return 'blue'
    return None

NUM = re.compile(r'^\d+(\.\d+)?$')

def extract(path):
    pg = pymupdf.open(path)[0]
    W = pg.rect.width
    rects = []
    for d in pg.get_drawings():
        z = zone(d['fill']) if d.get('fill') else None
        if z:
            for it in d['items']:
                if it[0] == 're': rects.append((it[1].x0, it[1].y0, it[1].x1, it[1].y1, z))
    words = pg.get_text('words')
    def colour(x, y): return next((r[4] for r in rects if r[0] <= x <= r[2] and r[1] <= y <= r[3]), 'white')
    out = []
    for half, (hx0, hx1) in (('left', (0, W / 2)), ('right', (W / 2, W))):
        zr = [r for r in rects if hx0 <= r[0] < hx1 and r[1] > 140]
        if not zr: continue
        x0s = sorted(set(round(r[0]) for r in zr))
        lab = max(x for x in x0s if sum(1 for r in zr if round(r[0]) == x) > 3)   # the right-most start of a graph section
        sx = (hx0 + hx1) / 2 + 25
        nums = sorted(((float(w[4]), (w[1] + w[3]) / 2) for w in words if NUM.match(w[4]) and float(w[4]) < 400 and hx0 + 8 <= w[0] and w[2] <= lab + 3), key=lambda t: t[1])
        runs, cur = [], []
        for v, y in nums:
            if cur and (v >= cur[-1][0] or y - cur[-1][1] > 16): runs.append(cur); cur = []
            if cur and len(cur) > 1 and abs((y - cur[-1][1]) - (cur[-1][1] - cur[-2][1])) > 3: runs.append(cur); cur = []
            cur.append((v, y))
        if cur: runs.append(cur)
        for run in runs:
            if len(run) < 3: continue
            gap = statistics.median(b[1] - a[1] for a, b in zip(run, run[1:]))
            bands = [{'lo': run[0][0], 'hi': None, 'zone': colour(sx, run[0][1] - gap / 2)}]
            for (va, ya), (vb, yb) in zip(run, run[1:]):
                hiZ, loZ = colour(sx, ya + (yb - ya) / 4), colour(sx, ya + 3 * (yb - ya) / 4)   # sub-rows: sample each half
                mid = (va + vb) / 2
                if hiZ == loZ: bands.append({'lo': vb, 'hi': va, 'zone': hiZ})
                else: bands += [{'lo': mid, 'hi': va, 'zone': hiZ}, {'lo': vb, 'hi': mid, 'zone': loZ}]
            bands.append({'lo': None, 'hi': run[-1][0], 'zone': colour(sx, run[-1][1] + gap / 2)})
            out.append({'half': half, 'scale': [v for v, _ in run], 'bands': bands})
        cats = []
        for w in words:
            if hx0 + 8 <= w[0] and w[2] <= lab + 3 and not NUM.match(w[4]):
                cats.append({'y': round((w[1] + w[3]) / 2, 1), 'text': w[4], 'zone': colour(sx, (w[1] + w[3]) / 2)})
        out.append({'half': half, 'labels': cats})
    return out

if __name__ == '__main__' and sys.argv[1] != '--spec':
    for sec in extract(sys.argv[1]):
        if 'scale' in sec:
            merged = []
            for b in sec['bands']:
                if merged and merged[-1]['zone'] == b['zone']: merged[-1]['lo'] = b['lo']
                else: merged.append(dict(b))
            print(sec['half'], 'scale', sec['scale'][0], '..', sec['scale'][-1], ' | ', '  '.join(f"{m['zone']}[{m['lo']},{m['hi']})" for m in merged))
        else:
            print(sec['half'], 'labels', ' '.join(f"{l['text']}:{l['zone'][0]}" for l in sec['labels'] if l['zone'] != 'white' or l['text'] in ('A', 'Nil', 'No', 'Normal')))


# ---- the spec the app reads (public/js/osce/obs-charts.mjs) ----------------------------------------------------------

CHARTS = [
    # id, file stem passed on the command line, title, ages (months, inclusive lo, exclusive hi), scales in page order, row steps
    ('sago', 'adult', 'Standard Adult General Observation Chart', 'Adults', (192, None), ['rr', 'spo2', 'sbp', 'hr', 'temp'], {'rr': 5, 'spo2': 5, 'sbp': 10, 'hr': 10, 'temp': 0.5}),
    ('spoc-12', 'p12plus', 'Standard Paediatric Observation Chart', '12 years and over', (144, 192), ['rr', 'spo2', 'hr', 'sbp', 'temp'], {'rr': 5, 'spo2': 5, 'hr': 5, 'sbp': 5, 'temp': 0.5}),
    ('spoc-5-11', 'p5to11', 'Standard Paediatric Observation Chart', '5 to 11 years', (60, 144), ['rr', 'spo2', 'hr', 'sbp', 'temp'], {'rr': 5, 'spo2': 5, 'hr': 5, 'sbp': 5, 'temp': 0.5}),
    ('spoc-1-4', 'p1to4', 'Standard Paediatric Observation Chart', '1 to 4 years', (12, 60), ['rr', 'spo2', 'hr', 'sbp', 'temp'], {'rr': 5, 'spo2': 5, 'hr': 5, 'sbp': 5, 'temp': 0.5}),
    ('spoc-3-12m', 'p3to12m', 'Standard Paediatric Observation Chart', '3 to 12 months', (3, 12), ['rr', 'spo2', 'hr', 'sbp', 'temp'], {'rr': 5, 'spo2': 5, 'hr': 5, 'sbp': 5, 'temp': 0.5}),
]

# category rows: (page half, the heading word the rows sit beside, then each row's own label word); the fill behind each
# row is read from the PDF below, never assumed
CATS = {
    'concern': ('left', ('Concern', 'CONCERN', 'Carer', 'CARER'), [('yes', ('Yes',)), ('no', ('No',)), ('na', ('Not',))]),
    'distress': ('left', ('Distress',), [('severe', ('Severe',)), ('moderate', ('Moderate', 'Mod')), ('mild', ('Mild',)), ('normal', ('Normal',))]),
    'crt': ('left', ('Capillary',), [('3+', ('≥',)), ('<3', ('<',))]),
    'avpu': ('right', ('A',), [('A', ('A',)), ('C', ('C',)), ('V', ('V',)), ('P', ('P',)), ('U', ('U',))]),
    'pain': ('right', ('Severe',), [('severe', ('Severe',)), ('moderate', ('Moderate',)), ('mild', ('Mild',)), ('nil', ('Nil',))]),
    'lactate': ('right', ('mmol/L',), [('4+', ('≥', '>')), ('2-3.9', ('to',)), ('<2', ('<',))]),
}

def spec(path, cid, title, ages_label, ages, order, steps):
    secs = extract(path)
    scales = [s for s in secs if 'scale' in s]
    if len(scales) != len(order): raise SystemExit(f'{path}: {len(scales)} scales, expected {len(order)}')
    params = {}
    for key, s in zip(order, scales):
        bands = []
        for b in s['bands']:
            if bands and bands[-1][2] == b['zone']: bands[-1][0] = b['lo']
            else: bands.append([b['lo'], b['hi'], b['zone']])
        top, bot, st = s['scale'][0], s['scale'][-1], steps[key]
        params[key] = {'min': bot - st, 'max': top + st, 'step': st, 'labels': s['scale'], 'bands': bands}
    # category rows: from the section's heading down, the first label of each row in turn, within 80 pt
    cats = {}
    for key, (half, anchors, rows) in CATS.items():
        if cid == 'sago' and key in ('distress', 'crt'): continue
        lab = sorted((l for sec in secs if sec.get('half') == half and 'labels' in sec for l in sec['labels']), key=lambda l: l['y'])
        head = next((l for l in lab if l['text'] in anchors), None)
        if not head: raise SystemExit(f'{path}: no {key} heading')
        y0, y, out = head['y'] - 30, head['y'] - 30, []
        for k, wordsk in rows:
            hit = next((l for l in lab if l['text'] in wordsk and y <= l['y'] <= y0 + 110), None)
            if not hit: raise SystemExit(f'{path}: no "{wordsk[0]}" row for {key}')
            out.append([k, 'grey' if k == 'na' else hit['zone']]); y = hit['y'] + 1
        cats[key] = out
    form = re.search(r'SMR\d{3}\.\d{3}', ' '.join(p.get_text() for p in pymupdf.open(path)))
    return {'id': cid, 'title': title, 'ages': ages_label, 'months': list(ages), 'form': form.group(0) if form else '', 'params': params, 'cats': cats}

if __name__ == '__main__' and len(sys.argv) > 2 and sys.argv[1] == '--spec':
    import os
    folder = sys.argv[2]
    out = [spec(os.path.join(folder, stem + '.pdf'), cid, title, al, ages, order, steps) for cid, stem, title, al, ages, order, steps in CHARTS]
    body = ',\n'.join('  ' + json.dumps(c, separators=(',', ':'), ensure_ascii=False) for c in out)
    js = ('/* WRITTEN BY scripts/charts/extract_zones.py from the NSW Health observation chart PDFs (vector fills between each\n'
          '   chart\'s own scale lines; category rows read beside their labels). Do not hand-edit: rerun the script.\n'
          '   A band is [lo, hi, zone]: lo <= value < hi, null is open. months: the ages a chart is for, [from, before). */\n'
          'export const CHARTS = [\n' + body + '\n];\n')
    if len(sys.argv) > 3: open(sys.argv[3], 'w').write(js)
    else: print(js)
