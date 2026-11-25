import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { resolvePremove, type QueuedPremove } from './premove.ts';

describe('premove', () => {
 const game = new Chess(); game.move('e4');
 const queued: QueuedPremove = { from: 'g1', to: 'f3', fen: game.fen(), session: 'line-1' };
 game.move('e5'); const reply = game.fen();
 it('executes a legal queued move after exactly one opponent reply', () => { expect(resolvePremove(queued, reply, 'line-1', 'w')).toBe('g1f3'); });
 it('discards changed sessions, unrelated positions, and illegal moves', () => { expect(resolvePremove(queued, reply, 'line-2', 'w')).toBeUndefined(); expect(resolvePremove(queued, new Chess().fen(), 'line-1', 'w')).toBeUndefined(); expect(resolvePremove({ ...queued, to: 'f4' }, reply, 'line-1', 'w')).toBeUndefined(); });
 it('does not automatically promote a pawn', () => { const before = new Chess('7k/P7/8/8/8/8/8/7K b - - 0 1'); const next = new Chess(before.fen()); next.move('Kh7'); expect(resolvePremove({ from: 'a7', to: 'a8', fen: before.fen(), session: 'x' }, next.fen(), 'x', 'w')).toBeUndefined(); });
});
