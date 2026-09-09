import { StyleSheet, View } from 'react-native';
import { surface, tokenColors } from '@/design/tokens';

/**
 * The mark: three lanes on a descending stagger - one filled to the brim, one two deep,
 * one holding a single disc. Colour being gathered lane by lane, which is the whole game.
 *
 * Drawn from the gameplay palette and the lane's own recess, so the mark and the board are
 * made of the same material. `scripts/generate-icons.mjs` draws the launcher assets from
 * these exact proportions; change one and change the other.
 */

/** Felt visible around a disc inside its lane, as a share of the lane's width. */
const LANE_PAD = 0.075;
const DISC = 1 - 2 * LANE_PAD;
/** Discs must read as separate pieces, never as one poured bar. */
const SLOT_GAP = 0.09;
const LANE_GAP = 0.24;
const DEPTH = 3;
/** Lane height in lane-widths. One number - `size` - sets every other dimension. */
const LANE_H = 2 * LANE_PAD + DEPTH * DISC + (DEPTH - 1) * SLOT_GAP;
/** A token is a flat fill with a 2px inset rim at 54pt: 3.7% of its diameter. */
const RIM = 0.037;

const VERMILION = 0;
const SKY = 1;
const EMERALD = 2;
const LANES = [
  { held: 3, colorId: EMERALD },
  { held: 2, colorId: VERMILION },
  { held: 1, colorId: SKY },
];

export function Logo({ size = 44 }: { size?: number }) {
  const laneW = size / LANE_H;
  const pad = laneW * LANE_PAD;
  const disc = laneW * DISC;
  const rim = Math.max(1, disc * RIM);

  return (
    <View style={[styles.row, { height: size, gap: laneW * LANE_GAP }]}>
      {LANES.map((lane, i) => {
        const palette = tokenColors[lane.colorId]!;
        return (
          <View
            key={i}
            style={[
              styles.lane,
              { width: laneW, borderRadius: laneW / 2, padding: pad, gap: laneW * SLOT_GAP },
            ]}
          >
            {Array.from({ length: lane.held }, (_, k) => (
              <View
                key={k}
                style={{
                  width: disc,
                  height: disc,
                  borderRadius: disc / 2,
                  backgroundColor: palette.fill,
                  borderColor: palette.shade,
                  borderWidth: rim,
                }}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch' },
  lane: {
    // Discs settle on the base, the way they do on the board.
    justifyContent: 'flex-end',
    backgroundColor: surface.recess,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: surface.hairline,
  },
});
