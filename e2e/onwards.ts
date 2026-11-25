import type { NodeHost } from '../scripts/nodeHost';

/**
 * The chair's way on from a reveal: one press, and a second only where that
 * press brought the table up (a break, or before a final — `afterReveal`).
 */
export async function onwards(running: Pick<NodeHost, 'dispatch' | 'until'>): Promise<void> {
  await running.dispatch({ type: 'next', at: Date.now() });
  const room = await running.until((each) => each.phase !== 'reveal');
  if (room.phase === 'scoreboard') await running.dispatch({ type: 'next', at: Date.now() });
}
