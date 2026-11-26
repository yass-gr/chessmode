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
		classification?: import('#lib/review/types.ts').Classification;
		glyph: string;
		color: string;
		label?: string;
	}
</script>

<script lang="ts">
	import LabelIcon from '#lib/components/review/LabelIcon.svelte';
	import { onMount, tick } from 'svelte';
	import { Chessground } from 'chessground';
	import type { Api } from 'chessground/api';
	import type { Key } from 'chessground/types';
	import type { DrawShape, DrawBrushes } from 'chessground/draw';
	import { Chess, type Square } from 'chess.js';
	import { boardColors } from '#lib/settings/appearance.ts';
	import type { BoardTheme, PieceSet } from '#lib/settings/types.ts';
	import { reducedMotion } from '#lib/motion.ts';
	import { resolvePremove, type QueuedPremove } from '#lib/settings/premove.ts';
	import { parseKeyboardMove } from '#lib/settings/keyboard.ts';
	import 'chessground/assets/chessground.base.css';
	import 'chessground/assets/chessground.cburnett.css';
 import './board-assets/pieces.css';

	interface Props {
		fen: string;
		orientation?: 'white' | 'black';
		/** Which side the user may move. 'none' makes the board view-only. */
		movable?: 'w' | 'b' | 'both' | 'none';
		lastMove?: [string, string];
		arrows?: Arrow[];
		marker?: Marker;
		coordinates?: boolean;
  theme?: BoardTheme;
  pieces?: PieceSet;
  premove?: { session: string };
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
  theme = 'default',
		pieces = 'cburnett',
  premove,
		onmove
	}: Props = $props();

	let el: HTMLDivElement;
	let cg: Api | undefined;
	let queued: QueuedPremove | undefined;
	let entry = $state('');
	let promoOverride: string | undefined;

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
		if (queued && (queued.session !== premove?.session || movable === 'none' || movable === 'both')) {
			queued = undefined;
			cg.cancelPremove();
		}
		if (queued && queued.fen !== fen) {
			const pending = queued;
			queued = undefined;
			cg.cancelPremove();
			if (premove && (movable === 'w' || movable === 'b')) {
				const move = resolvePremove(pending, fen, premove.session, movable);
				const currentFen = fen;
				const currentSession = premove.session;
				if (move) {
					queueMicrotask(() => {
						if (fen === currentFen && premove?.session === currentSession) onmove?.(move);
					});
				}
			}
		}
		const canMove = movable === 'both' || movable === turn;
		cg.set({
			fen,
			orientation,
			turnColor: turn === 'w' ? 'white' : 'black',
			lastMove: lastMove as Key[] | undefined,
			check: game?.inCheck() ? (turn === 'w' ? 'white' : 'black') : false,
			coordinates,
			premovable: { enabled: !!premove && (movable === 'w' || movable === 'b') },
			movable: {
				free: false,
				color: movable === 'both' ? (turn === 'w' ? 'white' : 'black') : movable === 'w' ? 'white' : movable === 'b' ? 'black' : undefined,
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
			animation: { enabled: !reducedMotion(), duration: 200 },
			highlight: { lastMove: true, check: true },
			premovable: {
				enabled: true,
				events: {
					set: (from, to) => {
						const current = cg?.state.premovable.current;
						const waiting = premove && (movable === 'w' || movable === 'b') && new Chess(fen).turn() !== movable;
						const piece = new Chess(fen).get(from as Square);
						const wouldPromote = piece?.type === 'p' && (piece.color === movable) && (to[1] === '8' || to[1] === '1');
						if (waiting && !wouldPromote && current?.[0] === from && current[1] === to) {
							queued = { from, to, fen, session: premove.session };
						} else cg?.cancelPremove();
					},
					unset: () => {
						if (!cg?.state.premovable.current) queued = undefined;
					}
				}
			},
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
						const needsPromotion = piece?.type === 'p' && (dest[1] === '8' || dest[1] === '1');
						const promo = needsPromotion ? promoOverride || 'q' : '';
						promoOverride = undefined;
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

	let entryFen = '';
	$effect(() => {
		// Track every prop that feeds the board.
		void [orientation, movable, lastMove, arrows, coordinates, premove];
		if (fen !== entryFen) {
			entryFen = fen;
			entry = '';
		}
		apply();
	});

	function cancelQueuedPremove() {
		queued = undefined;
		entry = '';
		cg?.cancelPremove();
	}

	function playTyped(force: boolean) {
		if (movable !== 'w' && movable !== 'b') return;
		const parsed = parseKeyboardMove(fen, entry, movable, force);
		if (!parsed || !cg) return;
		const orig = parsed.uci.slice(0, 2) as Key;
		const dest = parsed.uci.slice(2, 4) as Key;
		promoOverride = parsed.uci[4];
		entry = '';
		cg.selectSquare(orig);
		cg.selectSquare(dest);
		if (parsed.kind === 'premove' && !cg.state.premovable.current) promoOverride = undefined;
	}

	function onKeydown(event: KeyboardEvent) {
		if (movable !== 'w' && movable !== 'b') return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === 'Escape') {
			event.preventDefault();
			cancelQueuedPremove();
			return;
		}
		if (event.key === 'Backspace') {
			event.preventDefault();
			entry = entry.slice(0, -1);
			return;
		}
		if (event.key === 'Enter') {
			event.preventDefault();
			playTyped(true);
			return;
		}
		if (event.key.length !== 1 || !/[a-h1-8nbrqkox=#-]/i.test(event.key)) return;
		event.preventDefault();
		entry += event.key;
		playTyped(false);
	}

	function onPointerDown(event: PointerEvent) {
		// Right-click cancels a queued premove. Drawing still uses that button.
		if (event.button === 2) cancelQueuedPremove();
	}

	const markerPos = $derived.by(() => {
		if (!marker) return undefined;
		const file = marker.square.charCodeAt(0) - 97;
		const rank = +marker.square[1] - 1;
		const col = orientation === 'white' ? file : 7 - file;
		const row = orientation === 'white' ? 7 - rank : rank;
		return { left: `${(col + 1) * 12.5}%`, top: `${row * 12.5}%` };
	});
</script>

<!-- The board is the keyboard move target. It is a widget, not a button. -->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="board-wrap piece-{pieces}"
	style:--light={boardColors[theme][0]}
	style:--dark={boardColors[theme][1]}
	role="application"
	tabindex={movable === 'w' || movable === 'b' ? 0 : undefined}
	aria-label="Chess board. Type a move such as e4 or e2e4."
	data-entry={entry}
	onkeydown={onKeydown}
	onpointerdown={onPointerDown}
	oncontextmenu={cancelQueuedPremove}
>
	<div class="cg-host" bind:this={el}></div>
	{#if entry}
		<span class="entry">{entry}</span>
	{/if}
	{#if marker && markerPos}
		<span
			class="marker"
			class:badge={!!marker.classification}
			style:left={markerPos.left}
			style:top={markerPos.top}
			style:background={marker.classification ? undefined : marker.color}
			aria-label={marker.label}
			title={marker.label}>{#if marker.classification}<LabelIcon classification={marker.classification} size={32} />{:else}{marker.glyph}{/if}</span
		>
	{/if}
</div>

<style>
	.board-wrap {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border-radius: var(--r-sm);
		outline: none;
		box-shadow:
			0 0 0 1px rgba(255, 255, 255, 0.06),
			0 18px 40px -20px rgba(0, 0, 0, 0.9);
	}
	.board-wrap:focus-visible {
		box-shadow:
			0 0 0 2px var(--accent),
			0 18px 40px -20px rgba(0, 0, 0, 0.9);
	}
	.entry {
		position: absolute;
		z-index: 6;
		left: 8px;
		bottom: 8px;
		padding: 4px 8px;
		border-radius: var(--r-sm);
		background: var(--surface-1);
		color: var(--text);
		border: 1px solid var(--accent);
		font: 600 13px/1 var(--mono);
		pointer-events: none;
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
		width: 32px;
		min-width: 32px;
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
	.marker.badge {
		width: clamp(20px, 5.6%, 36px);
		min-width: 0;
		box-shadow: none;
	}
	.marker.badge :global(svg) {
		width: 100%;
		height: 100%;
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
		background: conic-gradient(var(--light) 25%, var(--dark) 0 50%, var(--light) 0 75%, var(--dark) 0) 0 0 / 25% 25%;
	}
	.board-wrap :global(cg-board square.current-premove) { background-color: rgba(255, 107, 44, 0.5); }
	.board-wrap :global(cg-board square.last-move) {
		background-color: rgba(255, 143, 87, 0.42);
	}
	.board-wrap :global(cg-board square.selected) {
		background-color: rgba(255, 107, 44, 0.5);
	}
	.board-wrap :global(cg-board square.move-dest) {
		background: radial-gradient(rgba(13, 13, 14, 0.28) 20%, transparent 22%);
	}
	@media (hover: hover) and (pointer: fine) {
		.board-wrap :global(cg-board square.move-dest:hover) {
			background: rgba(255, 107, 44, 0.3);
		}
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
	.board-wrap :global(.cg-wrap coords) {
		font: 600 clamp(8px, 1.9vw, 11px) / 1 var(--mono);
		opacity: 0.9;
	}
	.board-wrap :global(.cg-wrap coords.ranks) {
		left: 3px;
		top: 0;
		height: 100%;
		width: 12px;
	}
	.board-wrap :global(.cg-wrap coords.ranks coord) {
		transform: none;
		padding-top: 3px;
	}
	.board-wrap :global(.cg-wrap coords.files) {
		left: 0;
		bottom: 3px;
		height: auto;
		text-transform: none;
	}
	.board-wrap :global(.cg-wrap coords.files coord) {
		flex: 1 1 0;
		text-align: right;
		padding-right: 4px;
	}
	.board-wrap :global(.cg-wrap coords coord:nth-child(odd)) {
		color: var(--sq-light);
	}
	.board-wrap :global(.cg-wrap coords coord:nth-child(even)) {
		color: var(--sq-dark);
	}
	.board-wrap :global(.cg-wrap coords.black coord:nth-child(odd)) {
		color: var(--sq-dark);
	}
	.board-wrap :global(.cg-wrap coords.black coord:nth-child(even)) {
		color: var(--sq-light);
	}
</style>
