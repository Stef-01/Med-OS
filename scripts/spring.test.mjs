/* the springs (public/js/study-kit/spring.mjs): the physics, Apple's projection and rubber band, and the CSS tokens
   in public/css/osce.css are exactly what the solver gives */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { solve, easing, settle, project, rubberband, SPRING } from '../public/js/study-kit/spring.mjs';

test('a spring starts at 0 with the velocity it is given, ends at 1; critically damped never overshoots', () => {
  for (const s of Object.values(SPRING)) { const f = solve(s); assert.equal(f(0).x, 0); assert.ok(Math.abs(f(3).x - 1) < 1e-4); }
  const peak = s => { const f = solve(s); let p = 0; for (let t = 0; t < 2; t += 0.001) p = Math.max(p, f(t).x); return p; };
  assert.ok(peak(SPRING.smooth) <= 1.0001, 'damping 1: no overshoot');
  assert.ok(peak(SPRING.bouncy) > 1.02 && peak(SPRING.bouncy) < 1.08, 'damping 0.72: a little');
  assert.ok(Math.abs(solve({ damping: 0.8, response: 0.4 }, 5)(0).v - 5) < 1e-9, 'velocity hand-off');
  assert.ok(Math.abs(solve({ damping: 1.4, response: 0.3 }, -2)(0).v + 2) < 1e-9, 'overdamped too');
  assert.ok(settle(SPRING.snappy) < settle(SPRING.smooth) && settle(SPRING.smooth) < settle(SPRING.gentle), 'a quicker response settles sooner');
});
test("Apple's projection and rubber band", () => {
  assert.ok(Math.abs(project(1000) - 499) < 1);
  assert.ok(rubberband(100, 600) < 100 && rubberband(1000, 600) < 600 * 0.55 * 2);
  assert.equal(rubberband(0, 600), 0);
});
test('the CSS spring tokens are what easing() gives', () => {
  const css = readFileSync(new URL('../public/css/osce.css', import.meta.url), 'utf8');
  for (const [k, s] of Object.entries(SPRING)) {
    const e = easing(s);
    assert.ok(css.includes(`--sp-${k}: ${e.ease};`), `--sp-${k}`);
    assert.ok(css.includes(`--sp-${k}-ms: ${e.ms}ms;`), `--sp-${k}-ms`);
  }
});
