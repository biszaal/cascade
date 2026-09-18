import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { duration, radius, space, surface, type } from '@/design/tokens';
import { useProgress } from '@/state/progress';
import { chapters, getLevel, totalLevels } from '@/data/levels';
import { chapterColors } from '@/design/tokens';
import { StarRow } from '@/components/StarRow';
import { ChevronIcon } from '@/components/Icons';
import { metricsFor } from '@/game/responsive';
import { streakOn, streakTag } from '@/game/streak';
import { earnedIds } from '@/game/achievements';
import { utcDay } from '@/game/day';

export default function Home() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const metrics = metricsFor(width, height);
  const results = useProgress((s) => s.results);
  const totalStars = useProgress((s) => s.totalStars());
  const dailyStreak = useProgress((s) => s.dailyStreak);
  const dailyBest = useProgress((s) => s.dailyBest);
  const dailyLastDay = useProgress((s) => s.dailyLastDay);
  const seenRecords = useProgress((s) => s.seenRecords);

  const completed = Object.keys(results).length;
  const nextLevelId = Math.min(completed + 1, totalLevels);
  const nextLevel = getLevel(nextLevelId);
  const nextChapter = chapters.find((c) => c.chapter === nextLevel?.chapter);
  const accent = chapterColors[(nextChapter?.color ?? 0) % chapterColors.length]!;
  const lastResult = completed > 0 ? results[completed] : undefined;

  // A live streak is worth mentioning only while today's board is still unplayed; once it is
  // solved the number belongs on the daily screen, where it was just earned. This reads the
  // UTC day directly rather than through data/daily, which would drag the Supabase client
  // and the level generator into Home's module graph for one string.
  const today = utcDay();
  const streakDays = streakOn({ current: dailyStreak, best: dailyBest, lastDay: dailyLastDay }, today);
  const dailyLabel =
    dailyLastDay !== today && streakDays > 0
      ? `Daily challenge · ${streakTag(streakDays)}`
      : 'Daily challenge';

  // A record earned but not yet looked at. The dot on the chevron is the whole notification:
  // the win sheet already stamps three stars and plays a fanfare, and stacking a badge on top
  // of that is the celebration pile-on this game is built to avoid.
  const unseenRecords = earnedIds({ results, totalLevels, chapters, dailyBest }).some(
    (id) => !seenRecords.includes(id),
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View
        style={[
          styles.content,
          { maxWidth: metrics.contentWidth },
          // A phone wants the actions pinned to the bottom edge; a tall tablet wants the
          // whole column gathered in the middle, or the screen reads as two islands with
          // a void between them.
          metrics.isTablet && styles.contentCentred,
        ]}
      >
        {/* Left-aligned rather than centred - a centred hero is the default that makes
            everything look the same. */}
        <Animated.View entering={FadeInDown.duration(duration.enter)} style={styles.header}>
          <Logo size={52} />
          <Text style={[styles.wordmark, { fontSize: type.hero.fontSize * metrics.displayScale }]}>
            Cascade
          </Text>
          <Text style={styles.tagline}>
            One token at a time. The fewer moves it takes, the better you played.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(duration.enterStagger).duration(duration.enter)}>
          {/* The summary was already here and inert; making it the way in to Records costs no
              vertical space, where a fifth button would push the actions off a small phone. */}
          <Pressable
            onPress={() => router.push('/achievements')}
            style={styles.stats}
            accessibilityRole="button"
            accessibilityLabel="Records"
            accessibilityValue={{
              text: `${completed} of ${totalLevels} solved, ${totalStars} of ${totalLevels * 3} stars`,
            }}
          >
            <Stat label="SOLVED" value={`${completed}`} suffix={`/${totalLevels}`} />
            <View style={styles.statDivider} />
            <Stat label="STARS" value={`${totalStars}`} suffix={`/${totalLevels * 3}`} />
            <View style={styles.statsChevron}>
              <ChevronIcon />
              {unseenRecords ? <View style={styles.statsDot} /> : null}
            </View>
          </Pressable>
        </Animated.View>

        <View style={metrics.isTablet ? styles.spacerFixed : styles.spacer} />

        {/* The middle of a tall phone should carry information, not emptiness. This is
            what the primary button will actually open. */}
        {nextLevel ? (
          <Animated.View entering={FadeInDown.delay(duration.enterStagger * 2).duration(duration.enter)} style={styles.upNext}>
            <View style={[styles.upNextRule, { backgroundColor: accent }]} />
            <View style={styles.upNextBody}>
              <Text style={styles.upNextLabel}>UP NEXT</Text>
              <Text style={styles.upNextTitle}>
                {nextChapter?.name ?? 'Chapter'} · {nextLevel.index}
              </Text>
              <Text style={styles.upNextMeta}>
                {nextLevel.config.colorCount} colours · par {nextLevel.par}
              </Text>
            </View>
            {lastResult ? (
              <View style={styles.upNextStars}>
                <Text style={styles.upNextLabel}>LAST</Text>
                <StarRow stars={lastResult.stars} size={13} color={accent} />
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        <View style={metrics.isTablet ? styles.spacerFixed : styles.spacer} />

        <Animated.View entering={FadeInDown.delay(duration.enterStagger * 3).duration(duration.enter)} style={styles.actions}>
          <Button
            label={completed === 0 ? 'Start playing' : `Continue — level ${nextLevelId}`}
            onPress={() => router.push(`/play/${nextLevelId}`)}
            disabled={!nextLevel}
          />
          <Button label="Chapters" variant="outline" onPress={() => router.push('/chapters')} />
          <Button label={dailyLabel} variant="outline" onPress={() => router.push('/daily')} />
          <Button label="Settings" variant="quiet" onPress={() => router.push('/settings')} />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <View>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statSuffix}>{suffix}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.board },
  // Centred and capped: a full-bleed column of buttons across an iPad is a worse target,
  // not a bigger one.
  content: { flex: 1, width: '100%', alignSelf: 'center', paddingHorizontal: space.lg, paddingBottom: space.lg },

  header: { paddingTop: space.xl, gap: space.md },
  wordmark: { ...type.hero, color: surface.ink },
  tagline: { ...type.body, color: surface.graphite, maxWidth: 300 },

  stats: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.xl },
  statDivider: { width: 1, height: 34, backgroundColor: surface.hairline },
  statsChevron: { marginLeft: 'auto', width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  statsDot: {
    position: 'absolute',
    top: 1,
    right: 0,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: surface.accent,
  },
  statLabel: { ...type.label, fontSize: 10, letterSpacing: 1.2, color: surface.graphite },
  statValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  statValue: { ...type.numeralLarge, color: surface.ink },
  statSuffix: { ...type.numeral, color: surface.graphite },

  contentCentred: { justifyContent: 'center' },
  spacer: { flex: 1, minHeight: space.base },
  spacerFixed: { height: space.xl },

  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.base,
    padding: space.base,
    backgroundColor: surface.chalk,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: surface.hairline,
  },
  upNextRule: { width: 4, height: 44, borderRadius: 2 },
  upNextBody: { flex: 1, gap: 2 },
  upNextLabel: { ...type.label, fontSize: 10, letterSpacing: 1.2, color: surface.graphite },
  upNextTitle: { ...type.heading, fontSize: 18, color: surface.ink },
  upNextMeta: { ...type.label, color: surface.graphite },
  upNextStars: { alignItems: 'flex-end', gap: space.xs },

  actions: { gap: space.sm },
});
