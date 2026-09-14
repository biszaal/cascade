import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Board } from '@/components/Board';
import { StarRow } from '@/components/StarRow';
import { StuckSheet } from '@/components/StuckSheet';
import { BackIcon, UndoIcon } from '@/components/Icons';
import { font, radius, space, surface, type } from '@/design/tokens';
import { canUndo, useSession } from '@/state/session';
import { starsFor } from '@/game/scoring';
import { buildDailyLevel, fetchLeaderboard, submitDailyResult, todayKey, type LeaderboardRow } from '@/data/daily';
import { isSupabaseConfigured } from '@/supabase/client';
import { metricsFor } from '@/game/responsive';

/** As many leaderboard rows as fit under the result on the smallest phone, without scrolling. */
const LEADERBOARD_ROWS = 5;

export default function Daily() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  // The seed comes from the UTC date, so this is the same board for everyone, generated
  // on the device - it works with no network at all.
  const metrics = metricsFor(width, height);
  const level = useMemo(() => buildDailyLevel(), []);
  const session = useSession();
  const [board, setBoard] = useState<LeaderboardRow[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(isSupabaseConfigured);
  // The space left for the board once everything else on the page has taken its share.
  const [boardBox, setBoardBox] = useState<{ width: number; height: number } | null>(null);
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
    // The leaderboard is shown the moment the board is solved, so it reads as loading until
    // it includes this result, rather than briefly claiming nobody has finished.
    if (isSupabaseConfigured) setLoadingBoard(true);
    submitDailyResult(session.moves, timeMs)
      .then(() => fetchLeaderboard())
      .then(setBoard)
      .catch(() => {})
      .finally(() => setLoadingBoard(false));
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
  const undoable = canUndo(session);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <Header onBack={() => router.back()} />

      {/* One screen, never scrolled. While playing, the board takes whatever height is left;
          the leaderboard only appears once the board is solved and its space is free. */}
      <View style={[styles.content, { maxWidth: Math.max(metrics.contentWidth, metrics.boardWidth) }]}>
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
          <View style={styles.results}>
            <View style={styles.wonCard}>
              <StarRow stars={stars} size={20} />
              <Text style={styles.wonText}>
                Solved in {session.moves} {session.moves === 1 ? 'move' : 'moves'}
              </Text>
            </View>

            {/* The leaderboard needs a backend. Without one the section is left out entirely
                rather than shown empty: a player cannot act on "not configured". */}
            {isSupabaseConfigured ? <Leaderboard rows={board} loading={loadingBoard} /> : null}
          </View>
        ) : (
          <>
            <View
              style={styles.boardArea}
              onLayout={(event) => {
                const { width: w, height: h } = event.nativeEvent.layout;
                setBoardBox((box) => (box && box.width === w && box.height === h ? box : { width: w, height: h }));
              }}
            >
              {boardBox ? (
                <Board
                  state={session.state}
                  ids={session.ids}
                  selected={session.selected}
                  rejected={session.rejected}
                  justCompleted={session.justCompleted}
                  hintLane={null}
                  maxToken={metrics.maxToken}
                  width={Math.min(metrics.boardWidth, boardBox.width)}
                  height={boardBox.height}
                  onLanePress={session.tapLane}
                />
              ) : null}
            </View>

            <View style={styles.controls}>
              <Pressable
                onPress={session.undo}
                disabled={!undoable}
                accessibilityRole="button"
                accessibilityLabel="Undo"
                accessibilityValue={{ text: `${session.undosLeft} left` }}
                accessibilityState={{ disabled: !undoable }}
                style={[styles.control, !undoable && styles.controlOff]}
              >
                <UndoIcon color={undoable ? surface.ink : surface.graphite} />
                <Text style={styles.controlLabel}>Undo {session.undosLeft}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>

      <StuckSheet
        visible={session.stuck && !won}
        undosLeft={session.undosLeft}
        canUndo={undoable}
        onUndo={session.undo}
        onRestart={session.restart}
        onExit={() => router.back()}
      />
    </SafeAreaView>
  );
}

function Leaderboard({ rows, loading }: { rows: LeaderboardRow[]; loading: boolean }) {
  // Only the top few fit on one screen, so a player ranked below them gets their own row
  // added at the end rather than being left off their own leaderboard.
  const top = rows.slice(0, LEADERBOARD_ROWS);
  const selfIndex = rows.findIndex((row) => row.isSelf);
  const shown = selfIndex >= LEADERBOARD_ROWS ? [...top, rows[selfIndex]!] : top;

  return (
    <View style={styles.leaderboard}>
      <Text style={styles.sectionTitle}>TODAY'S BOARD</Text>
      {loading ? (
        // Skeleton rows matching the real layout, never a spinner.
        <View style={styles.skeletonGroup}>
          {Array.from({ length: LEADERBOARD_ROWS }, (_, i) => (
            <View key={i} style={styles.skeletonRow} />
          ))}
        </View>
      ) : shown.length === 0 ? (
        <Text style={styles.emptyText}>Results are still coming in. Check back later today.</Text>
      ) : (
        shown.map((row) => (
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
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        hitSlop={12}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
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

  content: {
    flex: 1,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: space.base,
    paddingBottom: space.base,
    gap: space.lg,
  },
  summary: { gap: space.xs },
  date: { ...type.numeral, fontSize: 12, color: surface.graphite, letterSpacing: 1 },
  headline: { ...type.heading, color: surface.ink, maxWidth: 320 },
  counters: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  counter: { minWidth: 58 },
  counterDivider: { width: 1, height: 28, backgroundColor: surface.hairline },
  counterLabel: { ...type.label, fontSize: 10, letterSpacing: 1.2, color: surface.graphite },
  counterValue: { ...type.numeralLarge, fontSize: 26, color: surface.ink },

  // Takes every point the summary and the controls leave; the board is sized to it.
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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

  results: { gap: space.lg },
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
  nameSelf: { fontFamily: font.display },
  rowMoves: { ...type.numeral, color: surface.ink },

  skeletonGroup: { gap: space.sm },
  skeletonRow: { height: 44, borderRadius: radius.sm, backgroundColor: surface.skeleton },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  // Left-aligned so it shares the left edge with the section label above it, rather than
  // floating in the middle of a wide tablet column.
  emptyText: { ...type.label, color: surface.graphite, lineHeight: 19, maxWidth: 420 },
});
