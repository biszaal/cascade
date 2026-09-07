import { StyleSheet, View } from 'react-native';
import { tokenColors } from '@/design/tokens';

/**
 * The mark: four quadrants around a centre, the shape every Ludo board shares, with one
 * token resting in its home. Drawn from the gameplay palette so the icon and the board
 * are made of the same material.
 */
export function Logo({ size = 44 }: { size?: number }) {
  const cell = size * 0.44;
  const gap = size * 0.12;
  const dot = cell * 0.46;
  const quadrants = [0, 2, 1, 3];

  return (
    <View style={[styles.grid, { width: size, height: size, gap }]}>
      {quadrants.map((colorIndex, i) => {
        const palette = tokenColors[colorIndex]!;
        return (
          <View
            key={i}
            style={[
              styles.cell,
              { width: cell, height: cell, borderRadius: cell * 0.32, backgroundColor: `${palette.fill}4D` },
            ]}
          >
            {i === 0 ? (
              <View
                style={{ width: dot, height: dot, borderRadius: dot, backgroundColor: palette.fill }}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { alignItems: 'center', justifyContent: 'center' },
});
