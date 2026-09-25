import { describe, it, expect } from 'vitest';
import { tintedSurface } from './tint';
import { chapterColors, surface } from './tokens';

describe('tinting the felt', () => {
  it('leaves the felt alone at zero', () => {
    expect(tintedSurface('#17161a', '#ff0000', 0)).toBe('#17161a');
  });

  it('becomes the accent at one', () => {
    expect(tintedSurface('#000000', '#ffffff', 1)).toBe('#ffffff');
  });

  it('mixes halfway', () => {
    expect(tintedSurface('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('clamps past either end rather than overshooting', () => {
    expect(tintedSurface('#000000', '#ffffff', 5)).toBe('#ffffff');
    expect(tintedSurface('#000000', '#ffffff', -5)).toBe('#000000');
  });

  it('returns the felt untouched for an accent it cannot parse', () => {
    expect(tintedSurface('#17161a', 'rebeccapurple', 0.5)).toBe('#17161a');
    expect(tintedSurface('#17161a', '', 0.5)).toBe('#17161a');
  });

  it('accepts every chapter accent that ships', () => {
    for (const accent of chapterColors) {
      expect(tintedSurface(surface.board, accent, 0.06)).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('stays close to the felt at the shipping amount, so no chrome turns colourful', () => {
    // Every channel within a handful of steps of the board it replaces.
    for (const accent of chapterColors) {
      const tinted = tintedSurface(surface.board, accent, 0.06);
      const drift = [1, 3, 5].map((i) =>
        Math.abs(parseInt(tinted.slice(i, i + 2), 16) - parseInt(surface.board.slice(i, i + 2), 16)),
      );
      expect(Math.max(...drift)).toBeLessThan(16);
    }
  });

  it('actually moves - a tint nobody can see is not worth the code', () => {
    expect(tintedSurface(surface.board, '#DDEBFA', 0.06)).not.toBe(surface.board.toLowerCase());
  });
});
