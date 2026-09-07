import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Board } from '@/components/Board';
import { Button } from '@/components/Button';
import { StarRow } from '@/components/StarRow';
import { BackIcon, UndoIcon } from '@/components/Icons';
import { radius, space, surface, type } from '@/design/tokens';
import { useSession, sessionIsStuck } from '@/state/session';
import { starsFor } from '@/game/scoring';
import { buildDailyLevel, fetchLeaderboard, submitDailyResult, todayKey, type LeaderboardRow } from '@/data/daily';
import { isSupabaseConfigured } from '@/supabase/client';

export default function Daily() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  // The seed comes from the UTC date, so this is the same board for everyone, generated
  // on the device - it works with no network at all.
  const level = useMemo(() => buildDailyLevel(), []);
  const session = useSession();
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(isSupabaseConfigured);
  const submitted = useRef(false);

  useEffect(() => {
    if (level) session.load(level);
    submitted.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    fetchLeaderboard()
      .then(setBoard)
      .catch(() => {})
      .finally(() => setLoadingBoard(false));
  }, []);

  useEffect(() => {
    if (session.status !== 'won' || !level || submitted.current) return;
    submitted.current = true;
    const timeMs = Date.now() - session.elapsedFrom;
    submitDailyResult(session.moves, timeMs)
      .then(() => fetchLeaderboard())
      .then(setBoard)
      .catch(() => {});
  }, [session.status, session.moves, session.elapsedFrom, level]);

  if (!level || !session.state) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <Header onBack={() => router.back()} />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Today's board could not be built. Try again shortly.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const won = session.status === 'won';
  const stars = won ? starsFor(session.moves, level.par) : 0;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}>
          <Text style={styles.date}>{todayKey()}</Text>
          <Text style={styles.headline}>One board. Everyone plays the same one.</Text>
          <View style={styles.counters}>
            <Counter label="MOVES" value={session.moves} />
            <View style={styles.counterDivider} />
            <Counter label="PAR" value={level.par} />
          </View>
        </View>

        {won ? (
          <View style={styles.wonCard}>
            <StarRow stars={stars} size={20} />
            <Text style={styles.wonText}>
              Solved in {session.moves} {session.moves === 1 ? 'move' : 'moves'}
            </Text>
          </View>
        ) : (
          <View style={styles.boardArea}>
            <Board
              state={session.state}
              ids={session.ids}
              selected={session.selected}
              rejected={session.rejected}
              justCompleted={session.justCompleted}
              hintLane={null}
              width={Math.min(width - space.base * 2, 460)}
              height={Math.max(220, height * 0.42)}
              onLanePress={session.tapLane}
            />
          </View>
        )}

        {!won ? (
          <View style={styles.controls}>
            <Pressable
              onPress={session.undo}
              disabled={session.history.length === 0}
              style={[styles.control, session.history.length === 0 && styles.controlOff]}
            >
              <UndoIcon color={session.history.length > 0 ? surface.ink : surface.graphite} />
              <Text style={styles.controlLabel}>Undo</Text>
            </Pressable>
            {sessionIsStuck(session.state) ? (
              <Button label="Restart" variant="outline" onPress={session.restart} />
            ) : null}
          </View>
        ) : null}

        <View style={styles.leaderboard}>
          <Text style={styles.sectionTitle}>TODAY'S BOARD</Text>
          {!isSupabaseConfigured ? (
            <Text style={styles.emptyText}>
              Leaderboards need a Supabase project. The puzzle itself works without one.
            </Text>
          ) : loadingBoard ? (
            // Skeleton rows matching the real layout, never a spinner.
            <View style={styles.skeletonGroup}>
              {[0, 1, 2, 3, 4].map((i) => (
                <View key={i} style={styles.skeletonRow} />
              ))}
            </View>
          ) : board.length === 0 ? (
            <Text style={styles.emptyText}>
              Nobody has finished today's board yet. Solve it and you top the list.
            </Text>
          ) : (
            board.map((row) => (
              <View key={`${row.rank}-${row.displayName}`} style={[styles.row, row.isSelf && styles.rowSelf]}>
                <Text style={styles.rank}>{String(row.rank).padStart(2, '0')}</Text>
                <Text style={[styles.name, row.isSelf && styles.nameSelf]} numberOfLines={1}>
                  {row.displayName}
                </Text>
                <Text style={styles.rowMoves}>{row.moves}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
        <BackIcon />
      </Pressable>
      <Text style={styles.title}>Daily challenge</Text>
    </View>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.counter}>
      <Text style={styles.counterLabel}>{label}</Text>
      <Text style={styles.counterValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.board },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.base, paddingVertical: space.md },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, color: surface.ink },

  scroll: { padding: space.base, gap: space.lg, paddingBottom: space.xxl },
  summary: { gap: space.xs },
  date: { ...type.numeral, fontSize: 12, color: surface.graphite, letterSpacing: 1 },
  headline: { ...type.heading, color: surface.ink, maxWidth: 300 },
  counters: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  counter: { minWidth: 58 },
  counterDivider: { width: 1, height: 28, backgroundColor: surface.hairline },
  counterLabel: { ...type.label, fontSize: 10, letterSpacing: 1.2, color: surface.graphite },
  counterValue: { ...type.numeralLarge, fontSize: 26, color: surface.ink },

  boardArea: { alignItems: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: space.sm },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    paddingHorizontal: space.base,
    minHeight: 44,
    borderRadius: radius.pill,
    backgroundColor: surface.chalk,
    borderWidth: 1,
    borderColor: surface.hairline,
  },
  controlOff: { opacity: 0.45 },
  controlLabel: { ...type.label, color: surface.ink },

  wonCard: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    backgroundColor: surface.chalk,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: surface.hairline,
  },
  wonText: { ...type.body, color: surface.ink },

  leaderboard: { gap: space.sm },
  sectionTitle: { ...type.label, fontSize: 10, letterSpacing: 1.4, color: surface.graphite },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: surface.hairline,
  },
  rowSelf: { backgroundColor: surface.accentSoft, borderRadius: radius.sm, paddingHorizontal: space.sm },
  rank: { ...type.numeral, color: surface.graphite, width: 26 },
  name: { ...type.body, color: surface.ink, flex: 1 },
  nameSelf: { fontFamily: 'Outfit_600SemiBold' },
  rowMoves: { ...type.numeral, color: surface.ink },

  skeletonGroup: { gap: space.sm },
  skeletonRow: { height: 44, borderRadius: radius.sm, backgroundColor: surface.skeleton },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  emptyText: { ...type.label, color: surface.graphite, textAlign: 'center', lineHeight: 19 },
});
