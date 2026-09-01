/* check_fact.js — flag real/mixed/fiction labels that may conflict with DECISIONS §6.6
 *
 *   node tools\check_fact.js
 *
 * ⚠ This is NOT a judge. It reads the English factNote text with regexes only.
 *   Its job is to reduce all scenes to a short list to eyeball — not to rule.
 *   If the label is right, fix the note's wording so it matches the label
 *   (a note that reads against its own label is a reader-facing bug too).
 *
 * The English idioms are locked in docs/GLOSSARY_EN.md §6:
 *   real    = on record, told straight — place, year, banner, outcome
 *   mixed   = on record but moved/shifted, or real and invented mixed
 *   fiction = not on record
 */
const path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'data', 'timeline.js'));

/* language that means "this was moved" — suggests mixed */
const MOVED = /moved|shifted|different (battlefield|year|place)|the invented (part|piece)|what (was|is) invented|(years?|seasons?) (later|earlier) than|not the year/i;
/* language that means "taken whole" — suggests real */
const WHOLE = /real in every detail|every detail (is |of it )?real|nothing (in this scene )?is invented|taken whole from the record|entirely real|real from end to end/i;

const beats = window.TK.timeline;
const tally = { real:0, mixed:0, fiction:0 };
const flags = [];

for (const b of beats){
  tally[b.fact] = (tally[b.fact] || 0) + 1;
  const s = (b.factNote || '').replace(/\s+/g, ' ');

  if (!['real','mixed','fiction'].includes(b.fact))
    flags.push([b, `bad label: "${b.fact}"`]);
  else if (!s)
    flags.push([b, 'no factNote — rule 6 requires one']);
  else if (b.fact === 'real'    && /invent/i.test(s) && MOVED.test(s))
    flags.push([b, 'labelled real but the note speaks of moving/invention']);
  else if (b.fact === 'mixed'   && WHOLE.test(s) && !MOVED.test(s))
    flags.push([b, 'labelled mixed but the note says taken whole']);
  else if (b.fact === 'fiction' && WHOLE.test(s))
    flags.push([b, 'labelled fiction but the note says parts are taken whole']);
}

console.log(`${beats.length} scenes — real ${tally.real} · mixed ${tally.mixed} · fiction ${tally.fiction}\n`);
for (const [b, why] of flags)
  console.log(`[${why}]\n  ${b.id} — ${b.title}\n  ${(b.factNote||'').replace(/\s+/g,' ')}\n`);

console.log(flags.length === 0
  ? 'no labels conflict with §6.6'
  : `${flags.length} scene(s) to eyeball (not necessarily wrong — read and judge)`);
process.exit(flags.length === 0 ? 0 : 1);
