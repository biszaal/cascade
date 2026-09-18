import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { duration, radius, space, surface, type } from '@/design/tokens';
import { chapters, totalLevels } from '@/data/levels';
import { useProgress } from '@/state/progress';
import { BackIcon } from '@/components/Icons';
import { StampedStar } from '@/components/StampedStar';
import { metricsFor } from '@/game/responsive';
import {
  RECORDS,
  describeRecord,
  earnedIds,
  isEarned,
  type Achievement,
  type ProgressSnapshot,
} from '@/game/achievements';

/**
 * Records, not achievements: this game has no trophy economy, and what it actually keeps is
 * a record of what you have solved and how close to the solver you got.
 *
 * Every row is derived on read, so opening this screen cannot lose or invent anything. The
 * only thing written is which records have been seen, so a new one stamps in once.
 */
export default function Records() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const metrics = metricsFor(width, height);

  const results = useProgress((s) => s.results);
  const dailyBest = useProgress((s) => s.dailyBest);
  const seenRecords = useProgress((s) => s.seenRecords);
  const markRecordsSeen = useProgress((s) => s.markRecordsSeen);

  const snapshot: ProgressSnapshot = useMemo(
    () => ({ results, totalLevels, chapters, dailyBest }),
    [results, dailyBest],
  );
  const earned = useMemo(() => earnedIds(snapshot), [snapshot]);

  // Captured once, on the first render: which records this visit is here to announce. Read
  // again on every render it would empty itself the moment they are marked seen, and the
  // stamps would never play.
  const [fresh] = useState(() => earned.filter((id) => !seenRecords.includes(id)));

  useEffect(() => {
    if (fresh.length > 0) markRecordsSeen(fresh);
  }, [fresh, markRecordsSeen]);

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
        <Text style={styles.title}>Records</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.list, { maxWidth: metrics.contentWidth }]}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={styles.summary}
          accessibilityLabel={`${earned.length} of ${RECORDS.length} records earned`}
        >
          EARNED {earned.length}/{RECORDS.length}
        </Text>

        {RECORDS.map((record, i) => (
          <Animated.View
            key={record.id}
            entering={FadeInDown.delay(Math.min(i, 6) * duration.enterStagger).duration(duration.enter)}
          >
            <Row record={record} snapshot={snapshot} stampIndex={fresh.indexOf(record.id)} />
          </Animated.View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  record,
  snapshot,
  stampIndex,
}: {
  record: Achievement;
  snapshot: ProgressSnapshot;
  stampIndex: number;
}) {
  const done = isEarned(record, snapshot);
  const progress = record.progress(snapshot);
  const tally = record.tally?.(snapshot);

  return (
    // Not a button - it does nothing. The whole row is one utterance, or a screen reader
    // reads a name, a sentence and a fraction as three unrelated things.
    <View
      style={[styles.card, !done && styles.cardUnearned]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={describeRecord(record, snapshot)}
    >
      <View style={styles.star}>
        <StampedStar filled={done} index={Math.max(stampIndex, 0)} size={26} animate={stampIndex >= 0} />
      </View>

      <View style={styles.body}>
        <Text style={styles.name}>{record.name}</Text>
        <Text style={styles.detail}>{record.detail}</Text>

        {/* A bar rather than a padlock: an unearned record should read as a thing in
            progress, which is what it is, not as a wall. */}
        <View style={styles.track}>
          <View
            style={[
              styles.trackFill,
              { width: `${Math.round(progress * 100)}%`, backgroundColor: done ? surface.accent : surface.inactive },
            ]}
          />
        </View>
        {tally ? <Text style={styles.tally}>{tally}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.board },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  back: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
  title: { ...type.title, color: surface.ink },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.sm, width: '100%', alignSelf: 'center' },
  summary: { ...type.label, color: surface.graphite, letterSpacing: 1, marginBottom: space.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    padding: space.md,
    backgroundColor: surface.chalk,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: surface.hairline,
  },
  cardUnearned: { opacity: 0.66 },
  star: { width: 26, alignItems: 'center', justifyContent: 'center', paddingTop: 2 },
  body: { flex: 1, gap: space.xs },
  name: { ...type.heading, color: surface.ink },
  detail: { ...type.label, color: surface.graphite },
  track: { height: 3, borderRadius: 2, backgroundColor: surface.track, overflow: 'hidden', marginTop: 2 },
  trackFill: { height: 3, borderRadius: 2 },
  tally: { ...type.label, color: surface.graphite },
});
