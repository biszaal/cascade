import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { chapterColors, space, surface, type } from '@/design/tokens';
import { getChapter, getChapterLevels } from '@/data/levels';
import { useProgress } from '@/state/progress';
import { BackIcon, LockIcon } from '@/components/Icons';
import { StarRow } from '@/components/StarRow';

const NODE = 46;
const ROW_HEIGHT = 92;

/**
 * Level select as a winding trail rather than a grid.
 *
 * A grid of numbered squares is what every puzzle game ships. A serpentine path reads as
 * a route around a board, which is the whole conceit of this game.
 */
export default function ChapterTrail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const chapterNumber = Number(id);
  const chapter = getChapter(chapterNumber);
  const levels = getChapterLevels(chapterNumber);
  const results = useProgress((s) => s.results);
  const isUnlocked = useProgress((s) => s.isUnlocked);

  const accent = chapterColors[(chapter?.color ?? 0) % chapterColors.length]!;
  const trackWidth = Math.min(width - space.lg * 2, 420);

  // Three nodes per row, alternating direction, so the eye follows a single continuous
  // route down the page.
  const nodes = useMemo(
    () =>
      levels.map((level, i) => {
        const row = Math.floor(i / 3);
        const column = i % 3;
        const leftToRight = row % 2 === 0;
        const slot = leftToRight ? column : 2 - column;
        const usable = trackWidth - NODE;
        // Lift the middle column so the route rises and falls between rows. Without this
        // the nodes land on a perfect grid and the trail reads as a table of numbers.
        const wave = slot === 1 ? -18 : 0;
        return { level, x: (usable / 2) * slot, y: row * ROW_HEIGHT + wave };
      }),
    [levels, trackWidth],
  );

  const path = useMemo(() => {
    if (nodes.length === 0) return '';
    let d = `M ${nodes[0]!.x + NODE / 2} ${nodes[0]!.y + NODE / 2}`;
    for (let i = 1; i < nodes.length; i++) {
      const from = nodes[i - 1]!;
      const to = nodes[i]!;
      const midY = (from.y + to.y) / 2 + NODE / 2;
      // Curve through the turns so the trail bends rather than zig-zags.
      d += ` C ${from.x + NODE / 2} ${midY}, ${to.x + NODE / 2} ${midY}, ${to.x + NODE / 2} ${to.y + NODE / 2}`;
    }
    return d;
  }, [nodes]);

  const height = nodes.length > 0 ? nodes[nodes.length - 1]!.y + NODE + space.lg : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <BackIcon />
        </Pressable>
        <View>
          <Text style={styles.title}>{chapter?.name ?? 'Chapter'}</Text>
          <Text style={styles.subtitle}>{levels.length} levels</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={{ width: trackWidth, height }}>
          <Svg width={trackWidth} height={height} style={StyleSheet.absoluteFill}>
            <Path
              d={path}
              stroke={surface.hairline}
              strokeWidth={3}
              fill="none"
              strokeLinecap="round"
              strokeDasharray="2 7"
            />
          </Svg>

          {nodes.map(({ level, x, y }, i) => {
            const result = results[level.id];
            const unlocked = isUnlocked(level.id, chapter?.firstLevelId ?? level.id);
            const solved = (result?.stars ?? 0) > 0;

            return (
              <Animated.View
                key={level.id}
                entering={FadeIn.delay(Math.min(i * 22, 400)).duration(280)}
                style={[styles.node, { left: x, top: y }]}
              >
                <Pressable
                  disabled={!unlocked}
                  onPress={() => router.push(`/play/${level.id}`)}
                  hitSlop={8}
                  style={[
                    styles.nodeButton,
                    {
                      backgroundColor: solved ? accent : surface.chalk,
                      borderColor: unlocked ? (solved ? accent : surface.hairline) : 'transparent',
                      opacity: unlocked ? 1 : 0.45,
                    },
                  ]}
                >
                  {unlocked ? (
                    <Text style={[styles.nodeNumber, { color: solved ? surface.chalk : surface.ink }]}>
                      {level.index}
                    </Text>
                  ) : (
                    <LockIcon size={18} />
                  )}
                </Pressable>
                <View style={styles.nodeStars}>
                  {result ? <StarRow stars={result.stars} size={11} color={accent} /> : null}
                </View>
              </Animated.View>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.board },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.base, paddingVertical: space.md },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: surface.ink },
  subtitle: { ...type.label, color: surface.graphite },

  scroll: { alignItems: 'center', paddingVertical: space.lg, paddingBottom: space.huge },
  node: { position: 'absolute', width: NODE, alignItems: 'center' },
  nodeButton: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeNumber: { ...type.numeral, fontFamily: 'JetBrainsMono_700Bold', fontSize: 15 },
  nodeStars: { marginTop: 5, height: 12 },
});
