import type { BoardTheme, PieceSet } from '#lib/settings/types.ts';

export const boardColors: Record<BoardTheme, readonly [string, string]> = {
	default: ['#c8c1b4', '#8b8378'],
	green: ['#d3d8c3', '#71896c'],
	brown: ['#e1c6a3', '#987151'],
	blue: ['#d4dce2', '#708ba1'],
	'dark-blue': ['#bdcbd1', '#465f72']
};

export const themeLabel: Record<BoardTheme, string> = {
	default: 'Default',
	green: 'Green',
	brown: 'Brown',
	blue: 'Blue',
	'dark-blue': 'Dark blue'
};

export const pieceLabel: Record<PieceSet, string> = {
	cburnett: 'Cburnett',
	merida: 'Merida',
	pirouetti: 'Pirouetti',
	chessnut: 'Chessnut'
};
