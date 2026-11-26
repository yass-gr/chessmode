import type { Fen, San } from '#lib/chess/types.ts';
import type { StudyBook } from '#lib/books/types.ts';

const fen = (value: string) => value as Fen;
const sans = (...moves: string[]) => moves as San[];

/**
 * Original notes for this app. The positions are standard endgame diagrams, not a transcription
 * of a published book. Reading stays separate from the opening courses.
 */
export const BOOKS: StudyBook[] = [
	{
		id: 'last-pieces',
		title: 'The last pieces',
		author: 'Chessmode',
		summary: 'How a queen or a rook, with its king, finishes a lone king.',
		sections: [
			{
				id: 'queen',
				title: 'Queen and king',
				paragraphs: [
					'A queen mates a lone king by shrinking the box the king can stand in. The queen stays a knight move away from the enemy king, so she is never adjacent and never capturable.',
					'Bring your own king up before you close the box all the way. The queen can hold a rank or a file by herself. The mate needs your king on the edge, beside the square the enemy king is forced onto.',
					'If the king is already on the edge, do not stalemate it. Leave it one square until your king is close enough to take that square away.'
				],
				line: {
					fen: fen('8/8/8/4k3/8/8/4Q3/4K3 w - - 0 1'),
					sans: sans('Qe4+', 'Kd6', 'Kd2', 'Kc7', 'Qd5', 'Kc8', 'Kc3', 'Kb8', 'Kb4'),
					caption: 'The queen cuts a rank, then the white king walks up before the box gets smaller.',
					orientation: 'white'
				},
				try: {
					fen: fen('8/8/8/8/8/4k3/4Q3/4K3 w - - 0 1'),
					caption: 'Your turn. Drive the king to the edge without offering the queen.',
					orientation: 'white'
				}
			},
			{
				id: 'rook',
				title: 'Rook and king',
				paragraphs: [
					'A rook mates the same way, one rank or file at a time. The rook checks from a distance. Your king opposes the enemy king so the check cannot be stepped toward the rook.',
					'Keep the rook on the rank or file next to the enemy king, not on the same one, until the mate. A rook beside the king with no protection is a rook lost.',
					'When the kings face each other with one square between them, a check along the edge is mate. That opposition is the whole idea.'
				],
				line: {
					fen: fen('8/8/8/8/k7/8/8/R3K3 w - - 0 1'),
					sans: sans('Kd2', 'Kb5', 'Kc3', 'Kc5', 'Ra5+'),
					caption: 'The king steps up first. The rook checks only when it cannot be taken.',
					orientation: 'white'
				},
				try: {
					fen: fen('k7/8/1K6/8/8/8/8/7R w - - 0 1'),
					caption: 'Your turn. The black king is already in the corner. Find the mate.',
					orientation: 'white'
				}
			}
		]
	},
	{
		id: 'king-and-pawn',
		title: 'King and pawn',
		author: 'Chessmode',
		summary: 'When one pawn is the only thing left, the kings decide the result.',
		sections: [
			{
				id: 'opposition',
				title: 'The opposition',
				paragraphs: [
					'Two kings stand in opposition when they are on the same file with one square between them, and it is the other side to move. The side that has just stepped into that picture has the opposition.',
					'With a pawn that is not yet on the seventh, the attacker wants the opposition so the defending king has to give ground. The defender wants it so the pawn can be blocked.',
					'Count the square in front of the pawn. If your king can reach that square, the pawn promotes. If the defending king reaches it and stays, the pawn falls or the game is drawn.'
				],
				line: {
					fen: fen('8/8/4k3/8/4P3/4K3/8/8 w - - 0 1'),
					sans: sans('Kd4', 'Kd6', 'e5+', 'Ke6', 'Ke4', 'Ke7', 'Kd5'),
					caption: 'White takes the opposition, then pushes only when the king has the next square.',
					orientation: 'white'
				}
			},
			{
				id: 'outside',
				title: 'The outside passed pawn',
				paragraphs: [
					'A passed pawn on the edge pulls the defending king away from the other pawns. You do not have to promote it. You have to make the other king go and fetch it.',
					'Push the outside pawn until the defender has to step toward it. Then bring your king to the pawns that were left behind.',
					'If you trade the outside pawn for the defender’s last pawn, look at the king and pawn that remain. The outside pawn was a ticket to that ending, not a trophy.'
				],
				line: {
					fen: fen('8/2k5/8/1P6/8/2K5/6p1/8 w - - 0 1'),
					sans: sans('b6+', 'Kb7', 'Kb4', 'Kxb6', 'Kc4'),
					caption: 'The b-pawn drags the black king over. White’s king is then closer to the other pawn.',
					orientation: 'white'
				},
				try: {
					fen: fen('8/8/8/8/2k5/8/P7/2K5 w - - 0 1'),
					caption: 'Your turn. The pawn is outside. Decide whether the king or the pawn should move first.',
					orientation: 'white'
				}
			}
		]
	}
];
