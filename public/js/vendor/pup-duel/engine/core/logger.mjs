/* logger.mjs: the engine's console voice (INFO for refused turn and stage endings, ERROR for refused actions).
   Ported from boardgame.io src/core/logger.ts at 5e9a2c9 (MIT, Copyright (c) 2017 The boardgame.io Authors; the
   licence is ../LICENSE). Changed: process.env is read through globalThis.process, so the module also loads in a
   browser with no bundler (where there is no process and so no production switch: INFO lines print); and a host may
   set where the lines go (setLogger), for a game that folds a log it does not control, where a refused move is the
   rules working rather than an error (Pup Duel's late answers). The console is the default, as upstream. */

const production = globalThis.process?.env?.NODE_ENV === 'production';
const logfn = production ? () => {} : (...msg) => console.log(...msg);
const errorfn = (...msg) => console.error(...msg);
let sink = { info: logfn, error: errorfn };

/* { info, error }: either or both; setLogger() puts the console back */
export function setLogger(to = {}) {
  sink = { info: to.info || logfn, error: to.error || errorfn };
}
export function info(msg) {
  sink.info(`INFO: ${msg}`);
}
export function error(error) {
  sink.error('ERROR:', error);
}
