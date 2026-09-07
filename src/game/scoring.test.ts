import { describe, it, expect } from 'vitest';
import { starsFor, movesUntilStarLost } from './scoring';

describe('stars', () => {
  it('awards three for matching par', () => {
    expect(starsFor(20, 20)).toBe(3);
  });

  it('awards three for beating par', () => {
    expect(starsFor(17, 20)).toBe(3);
  });

  it('awards two within a quarter over par', () => {
    expect(starsFor(25, 20)).toBe(2);
  });

  it('awards one for finishing well over par', () => {
    expect(starsFor(26, 20)).toBe(1);
  });

  it('awards nothing for an unfinished level', () => {
    expect(starsFor(0, 20)).toBe(0);
  });
});

describe('star warning', () => {
  it('counts down to losing the third star', () => {
    expect(movesUntilStarLost(18, 20)).toBe(2);
  });

  it('counts down to losing the second star once par is passed', () => {
    expect(movesUntilStarLost(20, 20)).toBe(5);
  });

  it('goes quiet when only one star remains', () => {
    expect(movesUntilStarLost(40, 20)).toBeNull();
  });
});
