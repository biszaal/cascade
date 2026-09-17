import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Board } from '@/components/Board';
import { HUD } from '@/components/HUD';
import { StuckSheet } from '@/components/StuckSheet';
import { WinSheet } from '@/components/WinSheet';
import { space, surface, type } from '@/design/tokens';
import { getLevel, totalLevels } from '@/data/levels';
import { canUndo, useSession } from '@/state/session';
import { useProgress } from '@/state/progress';
import { starsFor } from '@/game/scoring';
import { metricsFor } from '@/game/responsive';
import { queueResultSync } from '@/data/sync';

const HUD_HEIGHT = 210;

export default function Play() {
  const { levelId } = useLocalSearchParams<{ levelId: string }>();
  const router = useRouter();
  const { width, height } = useWindowDimensions();

  const id = Number(levelId);
  const level = useMemo(() => getLevel(id), [id]);

  const session = useSession();
  const recordResult = useProgress((s) => s.recordResult);
  const spendHint = useProgress((s) => s.spendHint);
  const hintsRemaining = useProgress((s) => s.hintsRemaining);
  const existing = useProgress((s) => s.results[id]);
  const hasPlayedBefore = useProgress((s) => Object.keys(s.results).length > 0);

  const [isBest, setIsBest] = useState(false);
  const recorded = useRef<number | null>(null);

  useEffect(() => {
    if (level) session.load(level);
    // A level opened after midnight should offer today's hints, not yesterday's leftovers.
    useProgress.getState().refreshHints();
    recorded.current = null;
    setIsBest(false);
    // Loading is keyed on the level id alone; re-running on every store change would
    // reset the board mid-play.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level?.id]);

  // Record the result exactly once per completion.
  useEffect(() => {
    if (session.status !== 'won' || !level || recorded.current === level.id) return;
    recorded.current = level.id;

    const stars = starsFor(session.moves, level.par);
    const timeMs = Date.now() - session.elapsedFrom;
    setIsBest(!existing || session.moves < existing.bestMoves);
    recordResult(level.id, stars, session.moves, timeMs);
    // Sync is fire-and-forget: a network failure must never interrupt the win screen.
    queueResultSync({ levelId: level.id, stars, moves: session.moves, timeMs }).catch(() => {});
  }, [session.status, session.moves, session.elapsedFrom, level, existing, recordResult]);

  if (!level || !session.state) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.missing}>
          <Text style={styles.missingText}>That level does not exist.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const metrics = metricsFor(width, height);
  const boardWidth = metrics.boardWidth;
  const boardHeight = Math.max(
    240,
    height - HUD_HEIGHT - (metrics.isTablet ? space.huge * 2 : space.xxl),
  );
  const undoable = canUndo(session);
  // Only on the very first level, only before the first move, and only for someone who
  // has never finished anything. After that the levels teach by constraint.
  const showFirstRunHint = level.id === 1 && session.moves === 0 && !hasPlayedBefore;
  const nextId = level.id + 1;
  const hasNext = nextId <= totalLevels;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={[styles.hud, { width: metrics.contentWidth }]}>
        <HUD
          levelLabel={`Level ${level.id}`}
          moves={session.moves}
          par={level.par}
          hintsRemaining={hintsRemaining}
          undosLeft={session.undosLeft}
          canUndo={undoable}
          onBack={() => router.back()}
          onUndo={session.undo}
          onRestart={session.restart}
          onHint={() => {
            // Only charge for a hint that was actually given - a board that cannot be
            // solved gets none.
            if (hintsRemaining <= 0) return;
            if (session.requestHint()) spendHint();
          }}
        />
      </View>

      <View style={styles.boardArea}>
        <Board
          maxToken={metrics.maxToken}
          state={session.state}
          ids={session.ids}
          selected={session.selected}
          rejected={session.rejected}
          justCompleted={session.justCompleted}
          hintLane={session.hint ? session.hint.to : null}
          width={boardWidth}
          height={boardHeight}
          onLanePress={session.tapLane}
        />
      </View>

      {/* One shared slot for the footer line, so showing or hiding it never shifts the
          board. */}
      <View style={styles.footer}>
        {showFirstRunHint ? (
          <Text style={styles.coach}>Tap a lane to lift its top piece, then tap another to drop it.</Text>
        ) : (
          <Text style={styles.footerPlaceholder} />
        )}
      </View>

      <StuckSheet
        visible={session.stuck}
        undosLeft={session.undosLeft}
        canUndo={undoable}
        onUndo={session.undo}
        onRestart={session.restart}
        onExit={() => router.back()}
      />

      <WinSheet
        visible={session.status === 'won'}
        stars={starsFor(session.moves, level.par)}
        moves={session.moves}
        par={level.par}
        isBest={isBest}
        hasNext={hasNext}
        onNext={() => router.replace(`/play/${nextId}`)}
        onReplay={session.restart}
        onExit={() => router.back()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: surface.board },
  // The HUD is capped and centred so it stays a readable cluster on a tablet instead of
  // flinging the back button and the hint button to opposite edges of the screen.
  hud: { paddingTop: space.sm, alignSelf: 'center' },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.base },
  footer: { minHeight: 30, alignItems: 'center', justifyContent: 'center', paddingBottom: space.sm },
  coach: { ...type.label, color: surface.graphite },
  footerPlaceholder: { height: 18 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { ...type.body, color: surface.graphite },
});
