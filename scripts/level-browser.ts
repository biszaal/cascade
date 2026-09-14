/**
 * Render every shipped level as a single HTML page. Run with `npm run browse`.
 *
 * This exists to make the curve reviewable at a glance. A list of numbers cannot tell you
 * whether two hundred levels feel different from each other; the boards side by side can,
 * and the pacing chart above them shows whether the sawtooth is actually there.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Level } from '../src/engine/types';
import { chapterColors as CHAPTER_COLORS, tokenColors as TOKENS } from '../src/design/tokens';
import { CHAPTERS } from './level-plan';

const here = dirname(fileURLToPath(import.meta.url));
const levelsDir = join(here, '..', 'assets', 'levels');
const out = join(here, '..', 'level-browser.html');

interface Pack { chapter: number; name: string; color: number; levels: Level[] }
const packs: Pack[] = CHAPTERS.map(
  (chapter) => JSON.parse(readFileSync(join(levelsDir, `chapter-${chapter.n}.json`), 'utf8')) as Pack,
);

const BEAT_COLOR: Record<string, string> = {
  teach: '#8FD4F5',
  build: '#98938B',
  rest: '#009E73',
  tight: '#E69F00',
  climax: '#D55E00',
};

function board(level: Level): string {
  const { lanes, hidden, capacity } = level.config;
  const laneHtml = lanes
    .map((tokens, i) => {
      const hiddenCount = hidden[i] ?? 0;
      const slots: string[] = [];
      // Draw top-down, so slot `capacity - 1` (the top of the stack) comes first.
      for (let slot = capacity - 1; slot >= 0; slot--) {
        const token = tokens[slot];
        if (token === undefined) {
          slots.push('<i class="slot empty"></i>');
        } else if (slot < hiddenCount) {
          slots.push('<i class="slot face-down">?</i>');
        } else {
          const t = TOKENS[token % TOKENS.length]!;
          slots.push(`<i class="slot" style="background:${t.fill};border-color:${t.shade}" title="${t.name}"></i>`);
        }
      }
      return `<div class="lane">${slots.join('')}</div>`;
    })
    .join('');
  // Eleven lanes will not fit a card at full size, so shrink the slots as lanes grow.
  const size = lanes.length >= 10 ? 10 : lanes.length >= 8 ? 12 : 15;
  return `<div class="board" style="--slot:${size}px">${laneHtml}</div>`;
}

function card(level: Level, chapterColor: string): string {
  const empties = level.config.lanes.filter((l) => l.length === 0).length;
  const maxHidden = level.config.hidden.reduce((a, b) => Math.max(a, b), 0);
  const beat = level.beat ?? 'build';
  return `
  <article class="card" data-beat="${beat}" data-chapter="${level.chapter}">
    <header>
      <span class="num" style="background:${chapterColor}">${level.id}</span>
      <span class="beat" style="color:${BEAT_COLOR[beat] ?? '#98938B'}">${beat}</span>
      <span class="par">par ${level.par}</span>
    </header>
    ${board(level)}
    <div class="shape">${level.config.colorCount}&thinsp;colours &middot; ${level.config.capacity}&thinsp;deep &middot; ${empties}&thinsp;free${maxHidden ? ` &middot; ${maxHidden}&thinsp;hidden` : ''}</div>
    <div class="meta"><span>difficulty ${level.difficulty}</span><span>${level.solution.length} moves</span></div>
    ${level.note ? `<p class="note">${level.note}</p>` : ''}
  </article>`;
}

const all = packs.flatMap((p) => p.levels);
const maxDifficulty = Math.max(...all.map((l) => l.difficulty));

/** The pacing chart: one bar per level, so the sawtooth is visible or it is not. */
const chart = all
  .map((l) => {
    const h = Math.round((l.difficulty / maxDifficulty) * 100);
    const color = BEAT_COLOR[l.beat ?? 'build'] ?? '#98938B';
    return `<span class="bar" style="height:${h}%;background:${color}" title="Level ${l.id} · ${l.beat} · difficulty ${l.difficulty} · par ${l.par}"></span>`;
  })
  .join('');

const sections = packs
  .map((pack) => {
    const color = CHAPTER_COLORS[pack.color % CHAPTER_COLORS.length]!;
    const pars = pack.levels.map((l) => l.par);
    return `
  <section>
    <h2><span class="swatch" style="background:${color}"></span>${pack.name}
      <small>${pack.levels.length} levels &middot; par ${Math.min(...pars)}&ndash;${Math.max(...pars)}</small>
    </h2>
    <div class="grid">${pack.levels.map((l) => card(l, color)).join('')}</div>
  </section>`;
  })
  .join('');

const shapes = new Set(
  all.map((l) => `${l.config.colorCount}-${l.config.capacity}-${l.config.lanes.filter((x) => x.length === 0).length}-${l.config.hidden.reduce((a, b) => Math.max(a, b), 0)}`),
);

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cascade — all ${all.length} levels</title>
<style>
  :root{--felt:#17161A;--chalk:#201F25;--ink:#F0EDE6;--graphite:#98938B;--hair:rgba(240,237,230,.13)}
  *{box-sizing:border-box}
  body{margin:0;background:var(--felt);color:var(--ink);
       font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
  .wrap{max-width:1240px;margin:0 auto;padding:40px 24px 80px}
  h1{font-size:34px;letter-spacing:-.8px;margin:0 0 6px}
  .sub{color:var(--graphite);margin:0 0 28px;max-width:62ch}
  .stats{display:flex;gap:28px;flex-wrap:wrap;margin:0 0 28px;padding:16px 0;
         border-top:1px solid var(--hair);border-bottom:1px solid var(--hair)}
  .stat b{display:block;font-size:22px;font-variant-numeric:tabular-nums}
  .stat span{color:var(--graphite);font-size:11px;letter-spacing:1.1px;text-transform:uppercase}
  .chart{display:flex;align-items:flex-end;gap:3px;height:120px;margin:0 0 6px;
         padding:12px;background:var(--chalk);border:1px solid var(--hair);border-radius:12px}
  .bar{flex:1;border-radius:2px 2px 0 0;min-height:3px;transition:opacity .15s}
  .bar:hover{opacity:.6}
  .legend{display:flex;gap:16px;flex-wrap:wrap;color:var(--graphite);font-size:12px;margin:0 0 40px}
  .legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px}
  section{margin:0 0 44px}
  h2{display:flex;align-items:center;gap:10px;font-size:19px;margin:0 0 16px;font-weight:600}
  h2 small{color:var(--graphite);font-weight:400;font-size:12px}
  .swatch{width:12px;height:12px;border-radius:3px}
  .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:14px}
  .card{background:var(--chalk);border:1px solid var(--hair);border-radius:14px;padding:13px}
  .card header{display:flex;align-items:center;gap:8px;margin-bottom:11px}
  .num{min-width:26px;height:22px;padding:0 7px;border-radius:11px;color:#17161A;
       font-weight:700;font-size:12px;display:grid;place-items:center;font-variant-numeric:tabular-nums}
  .beat{font-size:10px;letter-spacing:1.1px;text-transform:uppercase}
  .par{margin-left:auto;color:var(--graphite);font-size:12px;font-variant-numeric:tabular-nums}
  .board{display:flex;gap:4px;justify-content:center;align-items:flex-start;
         min-height:96px;margin-bottom:11px}
  .lane{display:flex;flex-direction:column;gap:2px;padding:3px;border-radius:6px;
        background:rgba(0,0,0,.26);border:1px solid var(--hair)}
  .board{--slot:15px}
  .slot{width:var(--slot);height:var(--slot);border-radius:50%;
        border:1.5px solid transparent;display:block}
  .slot.empty{background:transparent;border-color:transparent}
  .slot.face-down{background:rgba(240,237,230,.07);border-color:rgba(240,237,230,.17);
                  color:rgba(240,237,230,.42);font:700 9px/1 ui-monospace,monospace;
                  display:grid;place-items:center;font-style:normal}
  .shape{color:var(--ink);font-size:11.5px;text-align:center;margin-bottom:5px}
  .meta{display:flex;justify-content:space-between;color:var(--graphite);font-size:11px;
        font-variant-numeric:tabular-nums}
  .note{color:var(--graphite);font-size:11.5px;line-height:1.45;margin:9px 0 0;
        padding-top:9px;border-top:1px solid var(--hair)}
</style></head><body><div class="wrap">
  <h1>Cascade</h1>
  <p class="sub">Every shipped level, in order. The chart is the pacing curve &mdash; it should
  climb overall while dropping into a rest every few levels, rather than ramping straight up.</p>

  <div class="stats">
    <div class="stat"><b>${all.length}</b><span>levels</span></div>
    <div class="stat"><b>${packs.length}</b><span>chapters</span></div>
    <div class="stat"><b>${shapes.size}</b><span>distinct board shapes</span></div>
    <div class="stat"><b>${all.reduce((s, l) => s + l.par, 0)}</b><span>total par</span></div>
    <div class="stat"><b>${Math.min(...all.map((l) => l.par))}&ndash;${Math.max(...all.map((l) => l.par))}</b><span>par range</span></div>
  </div>

  <div class="chart">${chart}</div>
  <div class="legend">
    ${Object.entries(BEAT_COLOR).map(([k, v]) => `<span><i style="background:${v}"></i>${k}</span>`).join('')}
    <span style="margin-left:auto">hover a bar for detail</span>
  </div>

  ${sections}
</div></body></html>`;

writeFileSync(out, html);
console.log(`Wrote ${out}`);
console.log(`${all.length} levels · ${shapes.size} distinct board shapes`);
