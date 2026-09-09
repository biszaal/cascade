import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
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
import { metricsFor } from '@/game/responsive';

export default function Home() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const metrics = metricsFor(width, height);
  const results = useProgress((s) => s.results);
  const totalStars = useProgress((s) => s.totalStars());

  const completed = Object.keys(results).length;
  const nextLevelId = Math.min(completed + 1, totalLevels);
  const nextLevel = getLevel(nextLevelId);
  const nextChapter = chapters.find((c) => c.chapter === nextLevel?.chapter);
  const accent = chapterColors[(nextChapter?.color ?? 0) % chapterColors.length]!;
  const lastResult = completed > 0 ? results[completed] : undefined;

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

        <Animated.View entering={FadeInDown.delay(duration.enterStagger).duration(duration.enter)} style={styles.stats}>
          <Stat label="SOLVED" value={`${completed}`} suffix={`/${totalLevels}`} />
          <View style={styles.statDivider} />
          <Stat label="STARS" value={`${totalStars}`} suffix={`/${totalLevels * 3}`} />
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
          <Button label="Daily challenge" variant="outline" onPress={() => router.push('/daily')} />
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
