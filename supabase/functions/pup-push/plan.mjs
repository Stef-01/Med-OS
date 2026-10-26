/* plan.mjs - what pup-push sends, and when (pure; scripts/pup-push.test.mjs pins it). Plain JS so node tests it as is.

   Two notifications a day, in the phone's own time zone:
     09:00 to 11:59  a line from Confucius (the Analects, James Legge's translation of 1861: public domain), once a day
     18:00 to 20:59  "<dog> is sad": only on a day MDosce was not opened, once a day
   A phone that missed the window (asleep, offline, a cron run lost) gets nothing late: a 9 AM line at 2 PM would read
   as noise. */

export const QUOTES = [
  ['Is it not pleasant to learn with a constant perseverance and application?', '1.1'],
  ['If a man keeps cherishing his old knowledge, so as continually to be acquiring new, he may be a teacher of others.', '2.11'],
  ['Learning without thought is labour lost; thought without learning is perilous.', '2.15'],
  ['When you know a thing, to hold that you know it; and when you do not know a thing, to allow that you do not know it; this is knowledge.', '2.17'],
  ['When we see men of worth, we should think of equalling them.', '4.17'],
  ['They who know the truth are not equal to those who love it, and they who love it are not equal to those who delight in it.', '6.20'],
  ['When I walk along with two others, they may serve me as my teachers.', '7.21'],
  ['Learn as if you could not reach your object, and were always fearing also lest you should lose it.', '8.17'],
  ['If there want but one basket of earth to complete the work, and I stop, the stopping is my own work.', '9.18'],
  ['To have faults and not to reform them, this, indeed, should be pronounced having faults.', '15.30'],
  ['I have been the whole day without eating, and the whole night without sleeping, occupied with thinking. It was of no use. The better plan is to learn.', '15.31']
];

/* the phone's local date (YYYY-MM-DD) and minutes past midnight, from an IANA zone (a bad zone: UTC) */
export function localOf(now, tz) {
  let f;
  try { f = new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
  catch { f = new Intl.DateTimeFormat('en-CA', { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
  const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}
const dayNo = d => Math.floor(Date.parse(`${d}T00:00:00Z`) / 864e5);

/* the quote for a day: the same for every phone on that date, a new one each day */
export const quoteFor = day => QUOTES[((dayNo(day) % QUOTES.length) + QUOTES.length) % QUOTES.length];

/* what one subscription is due now: [] or [{ kind, title, body, mark }] (mark: the column to set to the local day) */
export function due(sub, now = new Date()) {
  const { day, min } = localOf(now, sub.tz), out = [];
  const name = String(sub.dog || '').trim() || 'Your dog';
  if (min >= 9 * 60 && min < 12 * 60 && sub.quote_on !== day) {
    const [q, ref] = quoteFor(day);
    out.push({ kind: 'quote', mark: 'quote_on', title: 'Confucius, for today', body: `“${q}” (Analects ${ref})` });
  }
  if (min >= 18 * 60 && min < 21 * 60 && sub.sad_on !== day && sub.opened_on !== day) {
    out.push({ kind: 'sad', mark: 'sad_on', title: `${name} is sad`, body: `You didn't log in today. ${name} misses you: one round of practice will cheer them up.` });
  }
  return out.map(x => ({ ...x, day }));
}
