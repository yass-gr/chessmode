<script lang="ts">
	import 'chessground/assets/chessground.cburnett.css';

	/** A static, non-interactive board thumbnail. Uses the same cburnett pieces as the main board. */
	let { fen, orientation = 'white', size = 56 }: { fen: string; orientation?: 'white' | 'black'; size?: number } = $props();

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

<div class="mini cg-wrap" style:width="{size}px" style:height="{size}px" aria-hidden="true">
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
		background-color: var(--sq-light);
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 8 8' shape-rendering='crispEdges'%3E%3Cpath fill='%238b8378' d='M1 0h1v1H1zM3 0h1v1H3zM5 0h1v1H5zM7 0h1v1H7zM0 1h1v1H0zM2 1h1v1H2zM4 1h1v1H4zM6 1h1v1H6zM1 2h1v1H1zM3 2h1v1H3zM5 2h1v1H5zM7 2h1v1H7zM0 3h1v1H0zM2 3h1v1H2zM4 3h1v1H4zM6 3h1v1H6zM1 4h1v1H1zM3 4h1v1H3zM5 4h1v1H5zM7 4h1v1H7zM0 5h1v1H0zM2 5h1v1H2zM4 5h1v1H4zM6 5h1v1H6zM1 6h1v1H1zM3 6h1v1H3zM5 6h1v1H5zM7 6h1v1H7zM0 7h1v1H0zM2 7h1v1H2zM4 7h1v1H4zM6 7h1v1H6z'/%3E%3C/svg%3E");
		background-size: 100% 100%;
		box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06);
	}
	piece {
		position: absolute;
		width: 12.5%;
		height: 12.5%;
		background-size: cover;
	}
</style>
