import type { Level } from '@/engine/types';

/**
 * Level packs are generated offline by scripts/generate-levels.ts and bundled as JSON.
 * Metro needs literal require paths, so the packs are listed explicitly.
 */
interface Pack {
  chapter: number;
  name: string;
  color: number;
  levels: Level[];
}

const packs: Pack[] = [
  require('../../assets/levels/chapter-1.json'),
  require('../../assets/levels/chapter-2.json'),
  require('../../assets/levels/chapter-3.json'),
  require('../../assets/levels/chapter-4.json'),
  require('../../assets/levels/chapter-5.json'),
  require('../../assets/levels/chapter-6.json'),
  require('../../assets/levels/chapter-7.json'),
  require('../../assets/levels/chapter-8.json'),
  require('../../assets/levels/chapter-9.json'),
  require('../../assets/levels/chapter-10.json'),
  require('../../assets/levels/chapter-11.json'),
  require('../../assets/levels/chapter-12.json'),
  require('../../assets/levels/chapter-13.json'),
  require('../../assets/levels/chapter-14.json'),
  require('../../assets/levels/chapter-15.json'),
];

export const chapters = packs.map((pack) => ({
  chapter: pack.chapter,
  name: pack.name,
  color: pack.color,
  levelCount: pack.levels.length,
  firstLevelId: pack.levels[0]?.id ?? 1,
}));

export const totalLevels = packs.reduce((sum, pack) => sum + pack.levels.length, 0);

const byId = new Map<number, Level>();
for (const pack of packs) for (const level of pack.levels) byId.set(level.id, level);

export function getLevel(id: number): Level | undefined {
  return byId.get(id);
}

export function getChapterLevels(chapter: number): Level[] {
  return packs.find((pack) => pack.chapter === chapter)?.levels ?? [];
}

export function getChapter(chapter: number) {
  return chapters.find((c) => c.chapter === chapter);
}
