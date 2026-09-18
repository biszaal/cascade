/**
 * Records: the long-term goals a par game can honestly offer.
 *
 * Every record is a pure function of what progress already stores, so nothing new is written
 * when one is earned. That removes a whole class of bug - a record cannot be lost, desynced
 * or missed because an event did not fire - at the cost of there being no unlock date, and
 * no unlock *moment* for anything earned before this screen shipped.
 *
 * Deliberately excluded, and this list is the point of the file as much as the records are:
 *
 * - Anything timed. `bestTimeMs` is recorded, but the store promises "never a timer, never a
 *   rush", and paying for speed would contradict the whole pitch.
 * - Anything for finishing without hints or undos. Hints are "a courtesy, not a currency"
 *   (src/game/hints.ts); rewarding abstinence turns them back into one.
 * - Session counts, tap counts, days opened. Fake round statistics, banned by DESIGN.md.
 */

/** The first chapter whose tenth level is a gate. Matches scripts/levels.test.ts. */
const FIRST_GATED_CHAPTER = 11;

export interface RecordChapter {
  chapter: number;
  name: string;
  firstLevelId: number;
  levelCount: number;
  hasFog: boolean;
  hasAnchors: boolean;
}

export interface ProgressSnapshot {
  results: Record<number, { stars: number }>;
  totalLevels: number;
  chapters: readonly RecordChapter[];
  /** The longest run of daily boards ever solved. */
  dailyBest: number;
}

export interface Achievement {
  id: string;
  name: string;
  /** Present tense, so it reads the same earned or not. */
  detail: string;
  /** 0..1. 1 means earned. */
  progress: (s: ProgressSnapshot) => number;
  /** The count under the bar. Omitted where a count would be noise. */
  tally?: (s: ProgressSnapshot) => string;
}

const ratio = (done: number, target: number): number =>
  target <= 0 ? 1 : Math.max(0, Math.min(1, done / target));

const ids = (c: RecordChapter): number[] =>
  Array.from({ length: c.levelCount }, (_, i) => c.firstLevelId + i);

const starsOf = (s: ProgressSnapshot, id: number): number => s.results[id]?.stars ?? 0;

const solvedCount = (s: ProgressSnapshot): number =>
  Object.values(s.results).filter((r) => r.stars > 0).length;

const atParCount = (s: ProgressSnapshot): number =>
  Object.values(s.results).filter((r) => r.stars === 3).length;

const totalStars = (s: ProgressSnapshot): number =>
  Object.values(s.results).reduce((sum, r) => sum + r.stars, 0);

const isComplete = (s: ProgressSnapshot, c: RecordChapter): boolean =>
  ids(c).every((id) => starsOf(s, id) > 0);

const isPerfect = (s: ProgressSnapshot, c: RecordChapter): boolean =>
  ids(c).every((id) => starsOf(s, id) === 3);

const completeChapters = (s: ProgressSnapshot): number =>
  s.chapters.filter((c) => isComplete(s, c)).length;

const perfectChapters = (s: ProgressSnapshot): number =>
  s.chapters.filter((c) => isPerfect(s, c)).length;

/** Solved anything in a chapter carrying `trait`. */
const touched = (s: ProgressSnapshot, trait: 'hasFog' | 'hasAnchors'): boolean =>
  s.chapters.some((c) => c[trait] && ids(c).some((id) => starsOf(s, id) > 0));

/** The last level of every gated chapter: 110, 120 ... 200. */
const gateIds = (s: ProgressSnapshot): number[] =>
  s.chapters
    .filter((c) => c.chapter >= FIRST_GATED_CHAPTER)
    .map((c) => c.firstLevelId + c.levelCount - 1);

const gatesPassed = (s: ProgressSnapshot): number =>
  gateIds(s).filter((id) => starsOf(s, id) > 0).length;

const namedChapter = (s: ProgressSnapshot, chapter: number): RecordChapter | undefined =>
  s.chapters.find((c) => c.chapter === chapter);

const finishedChapter = (s: ProgressSnapshot, chapter: number): number => {
  const c = namedChapter(s, chapter);
  return c && isComplete(s, c) ? 1 : 0;
};

const solvedIn = (s: ProgressSnapshot, chapter: number): number => {
  const c = namedChapter(s, chapter);
  return c ? ids(c).filter((id) => starsOf(s, id) > 0).length : 0;
};

const atPar = (target: number): Achievement['tally'] =>
  (s) => `${Math.min(atParCount(s), target)} of ${target} levels`;

export const RECORDS: readonly Achievement[] = [
  {
    id: 'first-pour',
    name: 'First pour',
    detail: 'Solve your first level.',
    progress: (s) => ratio(solvedCount(s), 1),
  },
  {
    id: 'chapter-done',
    name: 'Chapter done',
    detail: 'Finish every level in a chapter.',
    progress: (s) => ratio(completeChapters(s), 1),
    tally: (s) => `${completeChapters(s)} of ${s.chapters.length} chapters`,
  },
  {
    id: 'into-the-dark',
    name: 'Into the dark',
    detail: 'Solve a level holding tokens you cannot see.',
    progress: (s) => (touched(s, 'hasFog') ? 1 : 0),
  },
  {
    id: 'hold-fast',
    name: 'Hold fast',
    detail: 'Solve a level with an anchored token that never moves.',
    progress: (s) => (touched(s, 'hasAnchors') ? 1 : 0),
  },
  {
    id: 'on-par',
    name: 'On par',
    detail: 'Match the solver on a level, for three stars.',
    progress: (s) => ratio(atParCount(s), 1),
  },
  {
    id: 'ten-at-par',
    name: 'Ten at par',
    detail: 'Match the solver on ten levels.',
    progress: (s) => ratio(atParCount(s), 10),
    tally: atPar(10),
  },
  {
    id: 'fifty-at-par',
    name: 'Fifty at par',
    detail: 'Match the solver on fifty levels.',
    progress: (s) => ratio(atParCount(s), 50),
    tally: atPar(50),
  },
  {
    id: 'hundred-at-par',
    name: 'A hundred at par',
    detail: 'Match the solver on a hundred levels.',
    progress: (s) => ratio(atParCount(s), 100),
    tally: atPar(100),
  },
  {
    id: 'perfect-chapter',
    name: 'Perfect chapter',
    detail: 'Match the solver on every level in a chapter.',
    progress: (s) => ratio(perfectChapters(s), 1),
    tally: (s) => `${perfectChapters(s)} of ${s.chapters.length} chapters`,
  },
  {
    id: 'the-forge',
    name: 'The forge',
    detail: 'Finish Alloy, and with it the forge.',
    progress: (s) => finishedChapter(s, 15),
    tally: (s) => `${solvedIn(s, 15)} of ${namedChapter(s, 15)?.levelCount ?? 10} levels`,
  },
  {
    id: 'gatekeeper',
    name: 'Gatekeeper',
    detail: 'Pass every gate: the tenth level of each late chapter.',
    progress: (s) => ratio(gatesPassed(s), gateIds(s).length),
    tally: (s) => `${gatesPassed(s)} of ${gateIds(s).length} gates`,
  },
  {
    id: 'the-light',
    name: 'The light',
    detail: 'Finish Zenith, and with it the hardest board in the game.',
    progress: (s) => finishedChapter(s, 20),
    tally: (s) => `${solvedIn(s, 20)} of ${namedChapter(s, 20)?.levelCount ?? 10} levels`,
  },
  {
    id: 'every-board',
    name: 'Every board',
    detail: 'Solve every level in the game.',
    progress: (s) => ratio(solvedCount(s), s.totalLevels),
    tally: (s) => `${solvedCount(s)} of ${s.totalLevels} levels`,
  },
  {
    id: 'every-star',
    name: 'Every star',
    detail: 'Match the solver on every level in the game.',
    progress: (s) => ratio(totalStars(s), s.totalLevels * 3),
    tally: (s) => `${totalStars(s)} of ${s.totalLevels * 3} stars`,
  },
  {
    id: 'a-board-a-day',
    name: 'A board a day',
    detail: 'Solve a daily challenge.',
    progress: (s) => ratio(s.dailyBest, 1),
  },
  {
    id: 'seven-in-a-row',
    name: 'Seven in a row',
    detail: 'Solve the daily board seven days running.',
    progress: (s) => ratio(s.dailyBest, 7),
    tally: (s) => `${Math.min(s.dailyBest, 7)} of 7 days`,
  },
  {
    id: 'thirty-in-a-row',
    name: 'Thirty in a row',
    detail: 'Solve the daily board thirty days running.',
    progress: (s) => ratio(s.dailyBest, 30),
    tally: (s) => `${Math.min(s.dailyBest, 30)} of 30 days`,
  },
];

export function isEarned(record: Achievement, s: ProgressSnapshot): boolean {
  return record.progress(s) >= 1;
}

export function earnedIds(s: ProgressSnapshot): string[] {
  return RECORDS.filter((record) => isEarned(record, s)).map((record) => record.id);
}

/**
 * One record aloud. Colour and a progress bar carry this on screen; a screen reader gets the
 * same three facts in words, and "not yet earned" gives the UI test a hook without a
 * test-only label.
 */
export function describeRecord(record: Achievement, s: ProgressSnapshot): string {
  const state = isEarned(record, s) ? 'earned' : 'not yet earned';
  const tally = record.tally?.(s);
  return [`${record.name}, ${state}.`, record.detail, tally ? `${tally}.` : ''].filter(Boolean).join(' ');
}
