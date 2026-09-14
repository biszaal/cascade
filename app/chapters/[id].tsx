import { useEffect, useMemo, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Animated, { FadeIn } from 'react-native-reanimated';
import { chapterColors, duration, space, surface, type } from '@/design/tokens';
import { getChapter, getChapterLevels } from '@/data/levels';
import { useProgress } from '@/state/progress';
import { BackIcon, LockIcon } from '@/components/Icons';
import { StarRow } from '@/components/StarRow';
import { metricsFor } from '@/game/responsive';

const NODE_COMPACT = 46;
const NODE_REGULAR = 64;

/**
 * Level select as a winding trail rather than a grid.
 *
 * A grid of numbered squares is what every puzzle game ships. A serpentine path reads as
 * a route around a board, which is the whole conceit of this game.
 */
export default function ChapterTrail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const metrics = metricsFor(width, height);
  // A three-wide ribbon down the centre of an iPad wastes the screen; a tablet gets five
  // across and correspondingly larger nodes.
  const NODE = metrics.isTablet ? NODE_REGULAR : NODE_COMPACT;
  const columns = metrics.trailColumns;
  const ROW_HEIGHT = NODE * 2;

  const chapterNumber = Number(id);
  const chapter = getChapter(chapterNumber);
  const levels = getChapterLevels(chapterNumber);
  const results = useProgress((s) => s.results);
  const isUnlocked = useProgress((s) => s.isUnlocked);

  const accent = chapterColors[(chapter?.color ?? 0) % chapterColors.length]!;
  const trackWidth = Math.min(width - space.lg * 2, metrics.isTablet ? 720 : 420);

  // Three nodes per row, alternating direction, so the eye follows a single continuous
  // route down the page.
  const nodes = useMemo(
    () =>
      levels.map((level, i) => {
        const row = Math.floor(i / columns);
        const column = i % columns;
        const leftToRight = row % 2 === 0;
        const slot = leftToRight ? column : columns - 1 - column;
        const usable = trackWidth - NODE;
        // Lift the interior columns so the route rises and falls between rows. Without
        // this the nodes land on a perfect grid and the trail reads as a table of numbers.
        const isEdge = slot === 0 || slot === columns - 1;
        const wave = isEdge ? 0 : -18;
        return { level, x: (usable / (columns - 1)) * slot, y: row * ROW_HEIGHT + wave };
      }),
    [levels, trackWidth, columns, NODE, ROW_HEIGHT],
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
  }, [nodes, NODE]);

  const trackHeight = nodes.length > 0 ? nodes[nodes.length - 1]!.y + NODE + space.lg : 0;

  // The furthest level the player can actually attempt in this chapter.
  const currentIndex = useMemo(() => {
    const firstId = chapter?.firstLevelId ?? levels[0]?.id ?? 1;
    let index = 0;
    for (let i = 0; i < levels.length; i++) {
      if (!isUnlocked(levels[i]!.id, firstId)) break;
      index = i;
    }
    return index;
  }, [levels, chapter, isUnlocked]);

  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const target = nodes[currentIndex];
    if (!target) return;
    // Open on where the player actually is. Deep into chapter six their next level is
    // thirty nodes down, and making them scroll to it every time is a small daily tax.
    const y = Math.max(0, target.y - ROW_HEIGHT);
    const timer = setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 0);
    return () => clearTimeout(timer);
  }, [currentIndex, nodes, ROW_HEIGHT]);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <BackIcon />
        </Pressable>
        <View>
          <Text style={styles.title}>{chapter?.name ?? 'Chapter'}</Text>
          <Text style={styles.subtitle}>{levels.length} levels</Text>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: trackWidth, height: trackHeight }}>
          <Svg width={trackWidth} height={trackHeight} style={StyleSheet.absoluteFill}>
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
                entering={FadeIn.delay(Math.min(i * duration.stagger, duration.enter)).duration(duration.sheet)}
                style={[styles.node, { left: x, top: y, width: NODE }]}
              >
                <Pressable
                  disabled={!unlocked}
                  onPress={() => router.push(`/play/${level.id}`)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={
                    !unlocked
                      ? `Level ${level.index}, locked`
                      : result
                        ? `Level ${level.index}, solved, ${result.stars} of 3 stars, best ${result.bestMoves} moves, par ${level.par}`
                        : `Level ${level.index}, not yet solved, par ${level.par}`
                  }
                  accessibilityState={{ disabled: !unlocked }}
                  style={[
                    styles.nodeButton,
                    {
                      width: NODE,
                      height: NODE,
                      borderRadius: NODE / 2,
                      backgroundColor: solved ? accent : surface.chalk,
                      borderColor: unlocked ? (solved ? accent : surface.hairline) : 'transparent',
                      opacity: unlocked ? 1 : 0.45,
                    },
                  ]}
                >
                  {unlocked ? (
                    <Text
                      style={[
                        styles.nodeNumber,
                        { color: solved ? surface.chalk : surface.ink, fontSize: NODE * 0.33 },
                      ]}
                    >
                      {level.index}
                    </Text>
                  ) : (
                    <LockIcon size={NODE * 0.39} />
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
  node: { position: 'absolute', alignItems: 'center' },
  nodeButton: { borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  nodeNumber: { ...type.numeralLarge, fontSize: 15, lineHeight: 20 },
  nodeStars: { marginTop: 5, height: 12 },
});
