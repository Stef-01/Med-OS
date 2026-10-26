/* motion in the browser (study-kit/spring.mjs; run by smoke.mjs): a sheet arrives on its spring and settles, follows a
   dragging finger 1:1, springs back from a short drag, closes on a flick, and a press gives way at once. Measured from
   the live transform frame by frame, at 375 by 812 */
import path from 'node:path';

export async function motion({ chromium, BASE, SHOTS, ok }) {
  const b = await chromium.launch(), ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  await ctx.route(/^https:\/\//, r => r.abort());
  await ctx.route(/\/config\.js$/, r => r.fulfill({ contentType: 'text/javascript', body: "window.OSCE_CONFIG = { supabaseUrl: '', supabaseAnonKey: '' };" }));
  const pg = await ctx.newPage(), errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(BASE, { waitUntil: 'networkidle' }); await pg.waitForSelector('.os[data-ready]');
  const y = () => pg.evaluate(() => { const d = document.querySelector('.os-modal .os-dlg'); return d ? new DOMMatrix(getComputedStyle(d).transform).m42 : null; });

  /* the sheet arrives: sampled every frame, it falls from below, never jumps, and is at rest within its settle time */
  await pg.evaluate(() => { window.__ys = []; const f = () => { const d = document.querySelector('.os-modal .os-dlg'); if (d) window.__ys.push(new DOMMatrix(getComputedStyle(d).transform).m42); if (window.__ys.length < 60) requestAnimationFrame(f); }; requestAnimationFrame(f); });
  await pg.click('.os-start [data-os="lib"]');
  await pg.waitForTimeout(1100);
  const ys = (await pg.evaluate(() => window.__ys)).filter(v => v != null);
  const jumps = ys.slice(1).map((v, i) => Math.abs(v - ys[i])), h = await pg.evaluate(() => document.querySelector('.os-modal .os-dlg').offsetHeight);
  ok(ys.length > 10 && ys[0] > h * 0.5 && Math.abs(ys.at(-1)) < 1 && Math.max(...jumps) < h * 0.4, `motion: the sheet springs up from below and settles (${ys.length} frames, first ${Math.round(ys[0])} px, last ${ys.at(-1).toFixed(1)} px)`);
  ok(await pg.locator('.os-modal .os-grabber').isVisible(), 'motion: a phone sheet has a grabber');

  /* a short drag down follows the finger 1:1, then springs back */
  const head = await pg.locator('.os-modal .os-dlg-head').boundingBox(), x = head.x + head.width / 2, y0 = head.y + head.height / 2;
  await pg.mouse.move(x, y0); await pg.mouse.down();
  for (let i = 1; i <= 10; i++) { await pg.mouse.move(x, y0 + i * 9); await pg.waitForTimeout(25); }
  const held = await y();
  ok(Math.abs(held - 90) < 3, `motion: the sheet follows the finger 1:1 (${held.toFixed(1)} px for a 90 px drag)`);
  await pg.screenshot({ path: path.join(SHOTS, 'motion-drag.png') });
  await pg.waitForTimeout(150); await pg.mouse.up();
  await pg.waitForTimeout(900);
  ok(Math.abs(await y()) < 1 && await pg.locator('.os-modal .os-lib').count() === 1, 'motion: let go of a short, slow drag and it springs back');

  /* dragged up past the top it resists (rubber band) */
  await pg.mouse.move(x, y0); await pg.mouse.down();
  for (let i = 1; i <= 10; i++) { await pg.mouse.move(x, y0 - i * 10); await pg.waitForTimeout(16); }
  const up = await y(); await pg.mouse.up(); await pg.waitForTimeout(700);
  ok(up === 0 || (up < 0 && up > -100), `motion: dragging up past the top gives way less than the finger (${up.toFixed(1)} px for 100 px)`);

  /* a flick down closes it */
  await pg.mouse.move(x, y0); await pg.mouse.down();
  for (let i = 1; i <= 6; i++) { await pg.mouse.move(x, y0 + i * 30); await pg.waitForTimeout(12); }
  await pg.mouse.up();
  await pg.waitForSelector('.os-modal .os-lib', { state: 'detached', timeout: 2000 }).then(() => ok(true, 'motion: a flick down closes the sheet'), () => ok(false, 'motion: a flick down closes the sheet'));

  /* a press gives way at once (pointer-down, not release) */
  await pg.locator('.os-start [data-os="lib"]').scrollIntoViewIfNeeded(); await pg.waitForTimeout(200);
  const card = await pg.locator('.os-start [data-os="lib"]').boundingBox();
  await pg.mouse.move(card.x + 40, card.y + 30); await pg.mouse.down(); await pg.waitForTimeout(90);
  const sc = await pg.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.os-start [data-os="lib"]')).transform).a);
  ok(sc < 0.995, `motion: a card gives way under the finger (scale ${sc.toFixed(3)})`);
  await pg.mouse.up(); await pg.waitForTimeout(300);
  ok(!errs.length, `motion: no page errors${errs.length ? `: ${errs.join(' | ')}` : ''}`);
  await b.close();
}
