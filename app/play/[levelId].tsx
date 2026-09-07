import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Board } from '@/components/Board';
import { HUD } from '@/components/HUD';
import { WinSheet } from '@/components/WinSheet';
import { space, surface, type } from '@/design/tokens';
import { getLevel, totalLevels } from '@/data/levels';
import { useSession, sessionIsStuck } from '@/state/session';
import { useProgress } from '@/state/progress';
import { starsFor } from '@/game/scoring';
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

  const [isBest, setIsBest] = useState(false);
  const recorded = useRef<number | null>(null);

  useEffect(() => {
    if (level) session.load(level);
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

  const boardWidth = Math.min(width - space.base * 2, 480);
  const boardHeight = Math.max(240, height - HUD_HEIGHT - space.xxl);
  const stuck = sessionIsStuck(session.state);
  const nextId = level.id + 1;
  const hasNext = nextId <= totalLevels;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.hud}>
        <HUD
          levelLabel={`Level ${level.id}`}
          moves={session.moves}
          par={level.par}
          hintsRemaining={hintsRemaining}
          canUndo={session.history.length > 0}
          onBack={() => router.back()}
          onUndo={session.undo}
          onRestart={session.restart}
          onHint={() => {
            if (!spendHint()) return;
            session.requestHint();
          }}
        />
      </View>

      <View style={styles.boardArea}>
        <Board
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

      {/* A dead end is stated plainly and inline. No modal, because undo is right there. */}
      <View style={styles.footer}>
        {stuck ? (
          <Text style={styles.stuck}>No moves left — undo, or restart the board.</Text>
        ) : (
          <Text style={styles.stuckPlaceholder} />
        )}
      </View>

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
  hud: { paddingHorizontal: space.base, paddingTop: space.sm },
  boardArea: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.base },
  footer: { minHeight: 30, alignItems: 'center', justifyContent: 'center', paddingBottom: space.sm },
  stuck: { ...type.label, color: surface.accent },
  stuckPlaceholder: { height: 18 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  missingText: { ...type.body, color: surface.graphite },
});
