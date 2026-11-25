<script lang="ts">
	import { CLASSIFICATIONS } from '#lib/review/classify.ts';
	import { isRetryable } from '#lib/review/session.ts';
	import type { MoveReview } from '#lib/review/types.ts';

	let { win, moves, total, ply, onselect }: {
		win: readonly number[]; moves: readonly MoveReview[]; total: number; ply: number; onselect: (ply: number) => void;
	} = $props();

	const width = 440;
	const height = 88;
	const middle = height / 2;
	const x = (i: number, length: number) => 6 + i / Math.max(1, length) * (width - 12);
	const y = (percent: number) => height - 7 - percent / 100 * (height - 14);
	const points = $derived(win.map((percent, i) => [x(i, total), y(percent)]));
	const line = $derived(points.map(pair => pair.join(',')).join(' '));
	const area = $derived(points.length ? '6,' + middle + ' ' + line + ' ' + points.at(-1)?.[0] + ',' + middle : '');
	const marked = $derived(moves.filter(move => isRetryable(move) || move.classification === 'sharp' || move.classification === 'find'));
	let chart: SVGSVGElement;

	function selectAt(event: MouseEvent) {
		if (!event.detail) {
			onselect(Math.min(ply + 1, win.length - 1));
			return;
		}
		const bounds = chart.getBoundingClientRect();
		const position = (event.clientX - bounds.left) / bounds.width * width;
		onselect(Math.min(win.length - 1, Math.max(0, Math.round((position - 6) / (width - 12) * total))));
	}
</script>

<div class="card graph">
	<div class="heading"><h2>Evaluation</h2><span>White advantage ↑</span></div>
	<button type="button" class="plot" onclick={selectAt} disabled={!win.length} aria-label="Jump on evaluation graph">
		<svg bind:this={chart} viewBox="0 0 {width} {height}" preserveAspectRatio="none" aria-hidden="true">
			<line x1="6" x2={width - 6} y1={middle} y2={middle} stroke="var(--stroke-2)" stroke-dasharray="4 4" />
			{#if points.length}
				<polygon points={area} fill="var(--accent-soft)" />
				<polyline points={line} stroke="var(--accent-hi)" stroke-width="1.5" vector-effect="non-scaling-stroke" fill="none" />
				{#each marked as move (move.ply)}
					<circle cx={x(move.ply, total)} cy={y(move.winAfter)} r="3.8" fill={CLASSIFICATIONS[move.classification].color} stroke="var(--bg)" stroke-width="1">
						<title>{move.san} · {CLASSIFICATIONS[move.classification].label}</title>
					</circle>
				{/each}
			{/if}
			<line x1={x(ply, total)} x2={x(ply, total)} y1="2" y2={height - 2} stroke="var(--text-2)" stroke-width="1" />
		</svg>
	</button>
	<div class="axis"><span>Start</span><span>{total} plies</span></div>
</div>

<style>
	.graph { padding: 12px 14px 9px; }
	.heading, .axis { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
	h2 { font-size: 14px; }
	.heading span, .axis { color: var(--text-2); font: 10px var(--mono); }
	.plot { width: 100%; display: block; cursor: crosshair; }
	svg { display: block; width: 100%; height: 80px; }
</style>
