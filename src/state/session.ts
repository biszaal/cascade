import { create } from 'zustand';
import type { GameState, Level, Move } from '@/engine/types';
import {
  applyMove,
  canLift,
  canMove,
  cloneState,
  createState,
  isLaneComplete,
  isSolved,
  isStuck,
  moveFor,
  topRun,
} from '@/engine/rules';
import { hintMove } from '@/engine/solver';
import { starsFor } from '@/game/scoring';
import * as haptics from '@/game/haptics';

/**
 * One playthrough of one level.
 *
 * The engine state carries colours; this store carries a parallel grid of stable token
 * IDs so the UI can animate a specific disc from one lane to another. Without the IDs a
 * pour would look like tokens vanishing and reappearing rather than travelling.
 */

interface Snapshot {
  state: GameState;
  ids: number[][];
  moves: number;
}

export interface SessionState {
  level: Level | null;
  state: GameState | null;
  ids: number[][];
  moves: number;
  selected: number | null;
  history: Snapshot[];
  status: 'idle' | 'playing' | 'won';
  /** Bumped to trigger the shake on a refused move. */
  rejected: { lane: number; nonce: number } | null;
  /** Lanes finished since the last move, so the board can celebrate them. */
  justCompleted: number[];
  hint: Move | null;
  /** True while the player is still following the level's precomputed optimal line. */
  onOptimalPath: boolean;
  elapsedFrom: number;

  load: (level: Level) => void;
  tapLane: (index: number) => void;
  undo: () => void;
  restart: () => void;
  requestHint: () => Move | null;
  clearHint: () => void;
  stars: () => 0 | 1 | 2 | 3;
}

function freshIds(state: GameState): number[][] {
  let next = 0;
  return state.lanes.map((lane) => lane.tokens.map(() => next++));
}

function moveIds(ids: number[][], move: Move): number[][] {
  const copy = ids.map((lane) => [...lane]);
  const taken = copy[move.from]!.splice(copy[move.from]!.length - move.count, move.count);
  copy[move.to]!.push(...taken);
  return copy;
}

export const useSession = create<SessionState>((set, get) => ({
  level: null,
  state: null,
  ids: [],
  moves: 0,
  selected: null,
  history: [],
  status: 'idle',
  rejected: null,
  justCompleted: [],
  hint: null,
  onOptimalPath: true,
  elapsedFrom: 0,

  load: (level) => {
    const state = createState(level.config);
    set({
      level,
      state,
      ids: freshIds(state),
      moves: 0,
      selected: null,
      history: [],
      status: 'playing',
      rejected: null,
      justCompleted: [],
      hint: null,
      onOptimalPath: true,
      elapsedFrom: Date.now(),
    });
  },

  tapLane: (index) => {
    const { state, selected, level } = get();
    if (!state || !level || get().status !== 'playing') return;

    const lane = state.lanes[index];
    if (!lane) return;

    // Nothing held: pick this lane up, if there is anything to pick up. A lone anchor has
    // a token but cannot give it up, so it is refused here rather than lifted into a hold
    // that every drop would then shake off.
    if (selected === null) {
      if (!canLift(lane, state.capacity)) {
        set({ rejected: { lane: index, nonce: Date.now() } });
        haptics.tapInvalid();
        return;
      }
      haptics.tapLift();
      set({ selected: index, hint: null });
      return;
    }

    // Tapping the held lane again puts it back down.
    if (selected === index) {
      set({ selected: null });
      return;
    }

    if (!canMove(state, selected, index)) {
      // A refused pour usually means the player wants a different source, so switch to it
      // rather than making them tap twice.
      const target = state.lanes[index]!;
      if (canLift(target, state.capacity)) {
        haptics.tapLift();
        set({ selected: index });
      } else {
        haptics.tapInvalid();
        set({ rejected: { lane: index, nonce: Date.now() }, selected: null });
      }
      return;
    }

    const move = moveFor(state, selected, index);
    const snapshot: Snapshot = {
      state: cloneState(state),
      ids: get().ids.map((l) => [...l]),
      moves: get().moves,
    };

    const completedBefore = state.lanes.map((l) => isLaneComplete(l, state.capacity));
    // Always go through the engine. Re-implementing the pour here is how a UI silently
    // drifts out of agreement with the solver that computed this level's par.
    const next = applyMove(state, move);
    const nextIds = moveIds(get().ids, move);

    const justCompleted: number[] = [];
    next.lanes.forEach((l, i) => {
      if (isLaneComplete(l, next.capacity) && !completedBefore[i]) justCompleted.push(i);
    });

    const movesPlayed = get().moves + 1;
    const expected = level.solution[get().moves];
    const stillOnPath =
      get().onOptimalPath &&
      expected !== undefined &&
      expected.from === move.from &&
      expected.to === move.to &&
      expected.count === move.count;

    const won = isSolved(next);

    if (justCompleted.length > 0) haptics.tapComplete();
    else haptics.tapPlace();
    if (won) haptics.tapWin();

    set({
      state: next,
      ids: nextIds,
      moves: movesPlayed,
      selected: null,
      history: [...get().history, snapshot],
      justCompleted,
      hint: null,
      onOptimalPath: stillOnPath,
      status: won ? 'won' : 'playing',
    });
  },

  undo: () => {
    const history = get().history;
    const previous = history[history.length - 1];
    if (!previous) return;
    haptics.tapLift();
    set({
      state: previous.state,
      ids: previous.ids,
      moves: previous.moves,
      history: history.slice(0, -1),
      selected: null,
      justCompleted: [],
      hint: null,
      status: 'playing',
      // Once a move has been taken back the precomputed line no longer describes play.
      onOptimalPath: false,
    });
  },

  restart: () => {
    const level = get().level;
    if (level) get().load(level);
  },

  requestHint: () => {
    const { state, level, moves, onOptimalPath } = get();
    if (!state || !level) return null;
    const move = hintMove(state, { movesPlayed: moves, solution: level.solution, onPath: onOptimalPath });
    set({ hint: move, selected: move ? move.from : null });
    return move;
  },

  clearHint: () => set({ hint: null }),

  stars: () => {
    const { level, moves, status } = get();
    if (!level || status !== 'won') return 0;
    return starsFor(moves, level.par);
  },
}));

/** True when the board has no legal move left and is not solved. */
export function sessionIsStuck(state: GameState | null): boolean {
  return state ? isStuck(state) : false;
}

/** How many tokens would travel if the held lane poured into `to`. */
export function pourSize(state: GameState, from: number, to: number): number {
  if (!canMove(state, from, to)) return 0;
  return Math.min(topRun(state.lanes[from]!), state.capacity - state.lanes[to]!.tokens.length);
}
