<script lang="ts">
	import 'chessground/assets/chessground.cburnett.css';
 import './board-assets/pieces.css';
 import { boardColors } from '#lib/settings/appearance.ts';
 import type { BoardTheme, PieceSet } from '#lib/settings/types.ts';

	/** A static, non-interactive board thumbnail. Uses the same cburnett pieces as the main board. */
	let { fen, orientation = 'white', size = 56, theme = 'default', pieces: pieceSet = 'cburnett' }: { fen: string; orientation?: 'white' | 'black'; size?: number; theme?: BoardTheme; pieces?: PieceSet } = $props();

	const NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

	const pieces = $derived.by(() => {
		const out: { x: number; y: number; cls: string }[] = [];
		fen
			.split(' ')[0]
			.split('/')
			.forEach((row, y) => {
				let x = 0;
				for (const ch of row) {
					if (/\d/.test(ch)) x += +ch;
					else {
						const color = ch === ch.toUpperCase() ? 'white' : 'black';
						const fx = orientation === 'white' ? x : 7 - x;
						const fy = orientation === 'white' ? y : 7 - y;
						out.push({ x: fx, y: fy, cls: `${NAMES[ch.toLowerCase()]} ${color}` });
						x++;
					}
				}
			});
		return out;
	});
</script>

<div class="mini cg-wrap piece-{pieceSet}" style:width="{size}px" style:height="{size}px" aria-hidden="true" style:--light={boardColors[theme][0]} style:--dark={boardColors[theme][1]}>
	{#each pieces as p (p.x * 8 + p.y)}
		<piece class={p.cls} style:left="{p.x * 12.5}%" style:top="{p.y * 12.5}%"></piece>
	{/each}
</div>

<style>
	.mini {
		position: relative;
		flex: 0 0 auto;
		border-radius: 10px;
		overflow: hidden;
		background: conic-gradient(var(--light) 25%, var(--dark) 0 50%, var(--light) 0 75%, var(--dark) 0) 0 0 / 25% 25%;
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06);
	}
	piece {
		position: absolute;
		width: 12.5%;
		height: 12.5%;
		background-size: cover;
	}
</style>
