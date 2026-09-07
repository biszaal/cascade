import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { surface } from '@/design/tokens';

interface StarRowProps {
  stars: number;
  size?: number;
  color?: string;
  emptyColor?: string;
  gap?: number;
}

const STAR =
  'M12 2.4l2.9 5.9 6.5.95-4.7 4.58 1.11 6.47L12 17.35l-5.81 3.05 1.11-6.47L2.6 9.25l6.5-.95L12 2.4z';

/** Three stars, filled to the score. Drawn, not an emoji - emojis are banned in this UI. */
export function StarRow({ stars, size = 18, color = surface.accent, emptyColor = surface.inactive, gap = 3 }: StarRowProps) {
  return (
    <View
      style={[styles.row, { gap }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${stars} of 3 stars`}
    >
      {[0, 1, 2].map((i) => (
        <Svg key={i} width={size} height={size} viewBox="0 0 24 24">
          <Path d={STAR} fill={i < stars ? color : emptyColor} />
        </Svg>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
