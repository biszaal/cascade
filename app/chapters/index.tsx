import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { chapterColors, radius, space, surface, type } from '@/design/tokens';
import { chapters } from '@/data/levels';
import { useProgress } from '@/state/progress';
import { BackIcon, ChevronIcon, LockIcon } from '@/components/Icons';
import { metricsFor } from '@/game/responsive';

export default function Chapters() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const metrics = metricsFor(width, height);
  const chapterStars = useProgress((s) => s.chapterStars);
  const results = useProgress((s) => s.results);

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
        <Text style={styles.title}>Chapters</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { maxWidth: metrics.contentWidth }]}
        showsVerticalScrollIndicator={false}
      >
        {chapters.map((chapter, i) => {
          const earned = chapterStars(chapter.firstLevelId, chapter.levelCount);
          const possible = chapter.levelCount * 3;
          const previous = chapters[i - 1];
          // A chapter opens once the one before it is half-starred, so a player is never
          // walled off by a single puzzle they cannot crack.
          const requirement = previous ? previous.levelCount : 0;
          const unlocked =
            i === 0 || chapterStars(previous!.firstLevelId, previous!.levelCount) >= requirement;
          const accent = chapterColors[chapter.color % chapterColors.length]!;
          const played = Object.keys(results).filter(
            (id) => Number(id) >= chapter.firstLevelId && Number(id) < chapter.firstLevelId + chapter.levelCount,
          ).length;

          return (
            <Animated.View key={chapter.chapter} entering={FadeInDown.delay(i * 50).duration(360)}>
              <Pressable
                disabled={!unlocked}
                onPress={() => router.push(`/chapters/${chapter.chapter}`)}
                accessibilityRole="button"
                accessibilityLabel={
                  unlocked
                    ? `${chapter.name}, ${played} of ${chapter.levelCount} solved, ${earned} of ${possible} stars`
                    : `${chapter.name}, locked. Finish ${previous?.name} to open.`
                }
                accessibilityState={{ disabled: !unlocked }}
                style={[styles.card, !unlocked && styles.cardLocked]}
              >
                <View style={[styles.swatch, { backgroundColor: unlocked ? accent : surface.hairline }]} />
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{chapter.name}</Text>
                  <Text style={styles.cardMeta}>
                    {unlocked
                      ? `${played} of ${chapter.levelCount} solved · ${earned}/${possible} stars`
                      : `Finish ${previous?.name} to open`}
                  </Text>
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.trackFill,
                        { width: `${Math.round((earned / possible) * 100)}%`, backgroundColor: accent },
                      ]}
                    />
                  </View>
                </View>
                {unlocked ? <ChevronIcon /> : <LockIcon />}
              </Pressable>
            </Animated.View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.board },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.base, paddingVertical: space.md },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: surface.ink },

  list: { padding: space.base, gap: space.md, paddingBottom: space.xxl, width: '100%', alignSelf: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.base,
    padding: space.base,
    backgroundColor: surface.chalk,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: surface.hairline,
    minHeight: 88,
  },
  cardLocked: { opacity: 0.55 },
  swatch: { width: 6, height: 52, borderRadius: 3 },
  cardBody: { flex: 1, gap: space.xs + 2 },
  cardName: { ...type.heading, color: surface.ink },
  cardMeta: { ...type.label, color: surface.graphite },
  track: { height: 3, borderRadius: 2, backgroundColor: surface.track, overflow: 'hidden', marginTop: 2 },
  trackFill: { height: 3, borderRadius: 2 },
});
