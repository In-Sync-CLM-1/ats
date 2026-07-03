import { readFileSync } from 'fs';
import { SCENES } from './scenes.mjs';
const align = JSON.parse(readFileSync(new URL('./recordings/scenes/narration-align.json', import.meta.url), 'utf8'));
const SEP = ' ';
const starts = align.starts, dur = align.duration;
const timeAtChar = (i) => starts[Math.max(0, Math.min(i, starts.length - 1))];
let offset = 0;
SCENES.forEach((s, i) => {
  const charStart = offset, nextOffset = offset + s.narration.length + SEP.length;
  const start = timeAtChar(charStart);
  const end = i < SCENES.length - 1 ? timeAtChar(nextOffset) : dur;
  offset = nextOffset;
  console.log(`${s.name.padEnd(20)} ${start.toFixed(1).padStart(7)}s -> ${end.toFixed(1).padStart(7)}s  (${(end - start).toFixed(1)}s)`);
});
console.log('TOTAL audio', dur.toFixed(1));
