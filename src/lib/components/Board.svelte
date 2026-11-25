<script lang="ts" module>
	export type Brush = 'accent' | 'good' | 'bad' | 'info' | 'muted';
	export interface Arrow {
		from: string;
		to?: string;
		brush: Brush;
	}
	/** A small round badge in the top-right corner of a square, e.g. a move classification. */
	export interface Marker {
		square: string;
		glyph: string;
		color: string;
		label?: string;
	}
</script>

<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { Chessground } from 'chessground';
	import type { Api } from 'chessground/api';
	import type { Key } from 'chessground/types';
	import type { DrawShape, DrawBrushes } from 'chessground/draw';
	import { Chess, type Square } from 'chess.js';
	import 'chessground/assets/chessground.base.css';
	import 'chessground/assets/chessground.cburnett.css';

	interface Props {
		fen: string;
		orientation?: 'white' | 'black';
		/** Which side the user may move. 'none' makes the board view-only. */
		movable?: 'w' | 'b' | 'both' | 'none';
		lastMove?: [string, string];
		arrows?: Arrow[];
		marker?: Marker;
		coordinates?: boolean;
		onmove?: (uci: string) => void;
	}

	let {
		fen,
		orientation = 'white',
		movable = 'none',
		lastMove,
		arrows = [],
		marker,
		coordinates = true,
		onmove
	}: Props = $props();

	let el: HTMLDivElement;
	let cg: Api | undefined;

	const BRUSHES: Record<Brush, string> = {
		accent: '#ff6b2c',
		good: '#3ecf8e',
		bad: '#ff5a52',
		info: '#7cc4ff',
		muted: '#a3a3a8'
	};

	function legalDests(game: Chess): Map<Key, Key[]> {
		const dests = new Map<Key, Key[]>();
		for (const m of game.moves({ verbose: true })) {
			const list = dests.get(m.from as Key) ?? [];
			list.push(m.to as Key);
			dests.set(m.from as Key, list);
		}
		return dests;
	}

	function apply() {
		if (!cg) return;
		let game: Chess | undefined;
		try {
			game = new Chess(fen);
		} catch {
			game = undefined;
		}
		const turn = game?.turn() ?? 'w';
		const canMove = movable === 'both' || movable === turn;
		cg.set({
			fen,
			orientation,
			turnColor: turn === 'w' ? 'white' : 'black',
			lastMove: lastMove as Key[] | undefined,
			check: game?.inCheck() ? (turn === 'w' ? 'white' : 'black') : false,
			coordinates,
			movable: {
				free: false,
				color: canMove ? (turn === 'w' ? 'white' : 'black') : undefined,
				dests: canMove && game ? legalDests(game) : new Map()
			}
		});
		cg.setAutoShapes(
			arrows.map(
				(a): DrawShape => ({
					orig: a.from as Key,
					dest: a.to as Key | undefined,
					brush: a.brush
				})
			)
		);
	}

	onMount(() => {
		cg = Chessground(el, {
			animation: { enabled: true, duration: 200 },
			highlight: { lastMove: true, check: true },
			premovable: { enabled: false },
			draggable: { enabled: true, showGhost: true },
			drawable: {
				enabled: true,
				visible: true,
				brushes: Object.fromEntries(
					Object.entries(BRUSHES).map(([key, color]) => [key, { key, color, opacity: 0.9, lineWidth: 12 }])
				) as unknown as DrawBrushes
			},
			movable: {
				events: {
					after: (orig, dest) => {
						const game = new Chess(fen);
						const piece = game.get(orig as Square);
						const promo = piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1') ? 'q' : '';
						onmove?.(orig + dest + promo);
						// Re-sync after the parent reacts: keeps the move if `fen` changed, undoes it if not.
						tick().then(apply);
					}
				}
			}
		});
		apply();
		return () => cg?.destroy();
	});

	$effect(() => {
		// Track every prop that feeds the board.
		void [fen, orientation, movable, lastMove, arrows, coordinates];
		apply();
	});

	const markerPos = $derived.by(() => {
		if (!marker) return undefined;
		const file = marker.square.charCodeAt(0) - 97;
		const rank = +marker.square[1] - 1;
		const col = orientation === 'white' ? file : 7 - file;
		const row = orientation === 'white' ? 7 - rank : rank;
		return { left: `${(col + 1) * 12.5}%`, top: `${row * 12.5}%` };
	});
</script>

<div class="board-wrap">
	<div class="cg-host" bind:this={el}></div>
	{#if marker && markerPos}
		<span
			class="marker"
			style:left={markerPos.left}
			style:top={markerPos.top}
			style:background={marker.color}
			aria-label={marker.label}
			title={marker.label}>{marker.glyph}</span
		>
	{/if}
</div>

<style>
	.board-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border-radius: var(--r-sm);
		box-shadow:
			0 0 0 1px rgba(255, 255, 255, 0.06),
			0 18px 40px -20px rgba(0, 0, 0, 0.9);
	}
	.cg-host {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		overflow: hidden;
	}
	.marker {
		position: absolute;
		z-index: 5;
		width: 5.2%;
		min-width: 18px;
		aspect-ratio: 1;
		transform: translate(-60%, -40%);
		border-radius: 50%;
		display: grid;
		place-items: center;
		color: #0d0d0e;
		font: 700 clamp(9px, 1.6vw, 13px) / 1 var(--mono);
		box-shadow:
			0 0 0 2px rgba(13, 13, 14, 0.55),
			0 4px 10px rgba(0, 0, 0, 0.45);
		pointer-events: none;
		animation: pop 0.22s var(--ease-out);
	}
	@keyframes pop {
		from {
			transform: translate(-60%, -40%) scale(0.4);
			opacity: 0;
		}
	}
	.board-wrap :global(cg-container) {
		position: absolute;
		inset: 0;
	}
	.board-wrap :global(cg-board) {
		background-color: var(--sq-light);
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'%3E%3Cpath fill='%238b8378' d='M1 0h1v1H1zM3 0h1v1H3zM5 0h1v1H5zM7 0h1v1H7zM0 1h1v1H0zM2 1h1v1H2zM4 1h1v1H4zM6 1h1v1H6zM1 2h1v1H1zM3 2h1v1H3zM5 2h1v1H5zM7 2h1v1H7zM0 3h1v1H0zM2 3h1v1H2zM4 3h1v1H4zM6 3h1v1H6zM1 4h1v1H1zM3 4h1v1H3zM5 4h1v1H5zM7 4h1v1H7zM0 5h1v1H0zM2 5h1v1H2zM4 5h1v1H4zM6 5h1v1H6zM1 6h1v1H1zM3 6h1v1H3zM5 6h1v1H5zM7 6h1v1H7zM0 7h1v1H0zM2 7h1v1H2zM4 7h1v1H4zM6 7h1v1H6z'/%3E%3C/svg%3E");
		background-size: 100% 100%;
	}
	.board-wrap :global(cg-board square.last-move) {
		background-color: rgba(255, 143, 87, 0.42);
	}
	.board-wrap :global(cg-board square.selected) {
		background-color: rgba(255, 107, 44, 0.5);
	}
	.board-wrap :global(cg-board square.move-dest) {
		background: radial-gradient(rgba(13, 13, 14, 0.28) 20%, transparent 22%);
	}
	.board-wrap :global(cg-board square.move-dest:hover) {
		background: rgba(255, 107, 44, 0.3);
	}
	.board-wrap :global(cg-board square.oc.move-dest) {
		background: radial-gradient(transparent 0%, transparent 78%, rgba(13, 13, 14, 0.3) 80%);
	}
	.board-wrap :global(cg-board square.check) {
		background: radial-gradient(ellipse at center, rgba(255, 60, 40, 0.95) 0%, rgba(230, 40, 20, 0.6) 30%, rgba(160, 0, 0, 0) 70%);
	}
	.board-wrap :global(piece) {
		filter: drop-shadow(0 2px 1.5px rgba(0, 0, 0, 0.35));
	}
	.board-wrap :global(coords) {
		font: 600 10px var(--mono);
		opacity: 0.85;
	}
	.board-wrap :global(coords coord:nth-child(odd)) {
		color: var(--sq-light);
	}
	.board-wrap :global(coords coord:nth-child(even)) {
		color: var(--sq-dark);
	}
	.board-wrap :global(.cg-wrap coords.files) {
		bottom: 1px;
	}
</style>
