import { Chess } from 'chess.js';

export interface QueuedPremove { from: string; to: string; fen: string; session: string }

export function resolvePremove(queued: QueuedPremove, fen: string, session: string, side: 'w' | 'b'): string | undefined {
 if (queued.session !== session) return;
 try {
  const before = new Chess(queued.fen);
  if (before.turn() === side) return;
  const isReply = before.moves({ verbose: true }).some(move => {
   const next = new Chess(queued.fen);
   next.move(move);
   return next.fen() === fen;
  });
  if (!isReply) return;
  const after = new Chess(fen);
  if (after.turn() !== side) return;
  const move = after.moves({ verbose: true }).find(m => m.from === queued.from && m.to === queued.to && !m.promotion);
  return move ? move.from + move.to : undefined;
 } catch { return; }
}
