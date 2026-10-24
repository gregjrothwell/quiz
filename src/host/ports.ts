import type { AskedHistory, HistoryGroup } from '../engine/askedHistory';
import type { Rates } from '../engine/chaser';
import type { GameRecord } from '../engine/gameRecord';
import type { Action } from '../engine/reducer';
import type { QuizQuestion } from '../engine/state';
import type { PackId, SealedQuestion } from '../questions/types';

/**
 * Everything the host needs from the outside world, passed in rather than
 * imported (host-loop.md, A2). The browser hands it Firestore, the RTDB and the
 * vault; a Node harness hands it the same SDK pointed elsewhere. Nothing under
 * `src/host/` may import `src/firebase.ts` or `react` — `scripts/imports.test.ts`
 * walks the graph.
 */
export interface HostPorts {
  /**
   * Applies actions to the room *as it is when the write goes*, not as it was
   * when the move was decided — see `dispatch` in `useRoom`. {@link foldActions}
   * is the fold; the port owns "the newest room" and the write.
   */
  dispatch: (action: Action | Action[]) => Promise<void>;
  /** `rooms/{code}/host/beat`, stamped by the server. */
  beat: () => Promise<void>;
  /** Delete `players.{uid}` from the room. One write per uid. */
  removePlayer: (uid: string) => Promise<void>;
  /** The vault's answer, once the server agrees the window has closed. */
  resolveAnswer: (question: QuizQuestion) => Promise<number>;
  /** `games/{gameId}`. `'failed'` is worth another try; `'refused'` is not. */
  keepGame: (gameId: string, record: GameRecord) => Promise<'kept' | 'refused' | 'failed'>;
  now: () => number;
}

/** What dealing a round needs: the sealed packs and the season's question history. */
export interface PackPorts {
  loadPack: (packId: PackId) => Promise<SealedQuestion[]>;
  loadAsked: (packId: string, group: HistoryGroup) => Promise<AskedHistory>;
  recordAsked: (packId: string, ids: readonly string[], history: AskedHistory, group: HistoryGroup) => Promise<void>;
  /** The office's hit rates, for Mr Fries. Null when there are none to read. */
  loadRates?: () => Promise<Rates | null>;
}
