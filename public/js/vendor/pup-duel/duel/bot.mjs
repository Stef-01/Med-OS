/* bot.mjs: a practice mate. It accepts any duel it is sent and plays like a fair student: right about 70 % of the
   time, answering a quarter to three quarters of the way through the clock. Seeded, so a test can pin a game.
   practiceWorld() is a private little backend (the memory transport) with you and the bot in it: practice never
   touches the real project or your record. */

import { createSession } from './session.mjs';
import { secsOf } from './core.mjs';
import { memoryNet, realTimers } from './transport-memory.mjs';
import { rng } from './rng.mjs';
import { DEFAULT_DOG } from '../pup/rig/breeds.mjs';

export const BOT = { name: 'Rex', look: { dog: 'duke', wear: { head: 'snapback', face: 'aviators' } }, skill: 0.7, early: 0.25, late: 0.75 };

export function createBot({ transport, me, timers = realTimers, seed = 7, skill = BOT.skill, early = BOT.early, late = BOT.late, pollMs = 1200, onGame = () => {} }) {
  const r = rng(seed), sessions = new Map();
  let stopped = false, timer = null;

  function play(duel) {
    if (sessions.has(duel.id)) return;
    const planned = new Set();
    /* assigned before start(): start() paints at once, and that first view is the invite to accept */
    const s = createSession({
      transport, me, duel, timers,
      onChange(v) {
        if (v.stage.name === 'invited' && v.state.b === me.id) s.accept();
        if (v.stage.name === 'question' && !planned.has(v.stage.round)) {
          planned.add(v.stage.round);
          const q = v.question, secs = secsOf(v.state.setup, v.stage.round), wait = secs * 1000 * (early + (late - early) * r());
          const wrong = q.options.map((_, i) => i).filter(i => i !== q.answer);
          const choice = r() < skill ? q.answer : wrong[Math.floor(r() * wrong.length)];
          timers.setTimeout(() => { if (!stopped) s.answer(choice); }, wait);
        }
        if (v.state.phase === 'done' && !planned.has('end')) { planned.add('end'); timers.setTimeout(() => s.emote('gg'), 1200); onGame(v); }
      }
    });
    sessions.set(duel.id, s);
    s.start();
  }
  async function watch() {
    if (stopped) return;
    try { for (const d of await transport.inbox(me)) if ((d.status === 'invited' && d.b === me.id) || d.status === 'live') play(d); } catch { /* next time */ }
    if (!stopped) timer = timers.setTimeout(watch, pollMs);
  }
  return {
    start() { watch(); return this; },
    stop() { stopped = true; timers.clearTimeout(timer); sessions.forEach(s => s.stop()); },
    sessions
  };
}

/* you and the bot in a backend of your own: { transport, me, bot, stop } */
export async function practiceWorld({ name = 'You', look = { dog: DEFAULT_DOG, wear: {} }, timers = realTimers, latency = 120, seed = 7, bot = BOT } = {}) {
  const net = memoryNet({ latency, timers, seed });
  const meT = net.client('me'), botT = net.client('bot');
  const me = await meT.register(name.slice(0, 20).padEnd(2, '.'), '0000', look);
  const botMe = await botT.register(bot.name, '0000', bot.look);
  const b = createBot({ transport: botT, me: botMe, timers, seed, skill: bot.skill }).start();
  return { transport: meT, me, bot: botMe, net, stop: () => b.stop() };
}
