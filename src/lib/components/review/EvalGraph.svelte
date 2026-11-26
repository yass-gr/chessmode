<script lang="ts">
	import { CLASSIFICATIONS } from '#lib/review/classify.ts';
	import { isRetryable } from '#lib/review/session.ts';
	import type { MoveReview } from '#lib/review/types.ts';
	import { scoreValue, scoreText } from './evaluation.ts';

	let { win, moves, total, ply, onselect }: { win: readonly number[]; moves: readonly MoveReview[]; total: number; ply: number; onselect: (ply: number) => void } = $props();
	const width = 440, height = 88, middle = height / 2;
	const x = (i: number) => 6 + i / Math.max(1, total) * (width - 12);
	const y = (value: number) => middle - value / 5.75 * (middle - 6);
	const points = $derived(moves.length && win.length ? [{ ply: 0, value: scoreValue(moves[0].best.score, moves[0].color) }, ...moves.filter(move => move.ply < win.length).map(move => ({ ply: move.ply, value: scoreValue(move.scoreAfter, move.color === 'w' ? 'b' : 'w') }))] : []);
	const line = $derived(points.length ? `M${x(points[0].ply)} ${y(points[0].value)}` + points.slice(1).map((p, i) => { const previous = points[i]; const midpoint = (x(previous.ply) + x(p.ply)) / 2; return ` C${midpoint} ${y(previous.value)} ${midpoint} ${y(p.value)} ${x(p.ply)} ${y(p.value)}`; }).join('') : '');
	const area = $derived(points.length ? `${line} L${x(points[points.length - 1].ply)} ${middle} L${x(0)} ${middle} Z` : '');
	const marked = $derived(moves.filter(move => move.ply < win.length && (isRetryable(move) || move.classification === 'sharp' || move.classification === 'find')));
	let hover = $state<number | undefined>();
	let chart: SVGSVGElement;
	const maxPly = $derived(points.at(-1)?.ply ?? 0);
	function at(event: MouseEvent | PointerEvent) {
		const bounds = chart.getBoundingClientRect();
		return Math.max(0, Math.min(maxPly, Math.round(((event.clientX - bounds.left) / bounds.width * width - 6) / (width - 12) * total)));
	}
	function keys(event: KeyboardEvent) {
		let next = ply;
		if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next++;
		else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next--;
		else if (event.key === 'Home') next = 0;
		else if (event.key === 'End') next = maxPly;
		else return;
		event.preventDefault(); onselect(Math.max(0, Math.min(maxPly, next)));
	}
	const hoveredMove = $derived(moves.find(move => move.ply === hover));
</script>

<div class="card graph">
	<div class="heading"><h2>Evaluation</h2><span>White advantage ↑</span></div>
	<div class="plot" role="slider" tabindex={points.length ? 0 : -1} aria-label="Selected position on evaluation graph" aria-valuemin="0" aria-valuemax={maxPly} aria-valuenow={Math.min(ply, maxPly)} aria-valuetext={points.length ? `Ply ${Math.min(ply, maxPly)}` : 'Evaluation unavailable'} onpointermove={(event) => { hover = at(event); }} onpointerleave={() => { hover = undefined; }} onclick={(event) => { if (points.length) onselect(at(event)); }} onkeydown={keys}>
		<svg bind:this={chart} viewBox="0 0 {width} {height}" preserveAspectRatio="none" aria-hidden="true">
			<defs><clipPath id="graph-white"><rect width={width} height={middle} /></clipPath><clipPath id="graph-black"><rect y={middle} width={width} height={middle} /></clipPath></defs>
			<line x1="6" x2={width - 6} y1={middle} y2={middle} stroke="var(--stroke-2)" stroke-dasharray="4 4" />
			{#if points.length}
				<path d={area} fill="var(--eval-graph-white)" opacity=".32" clip-path="url(#graph-white)" />
				<path d={area} fill="var(--eval-graph-black)" opacity=".35" clip-path="url(#graph-black)" />
				<path d={line} stroke="var(--text-2)" stroke-width="1.5" vector-effect="non-scaling-stroke" fill="none" />
				{#each marked as move (move.ply)}<circle cx={x(move.ply)} cy={y(scoreValue(move.scoreAfter, move.color === 'w' ? 'b' : 'w'))} r={move.ply === ply ? 5 : 4} fill={CLASSIFICATIONS[move.classification].color} stroke="var(--bg)" stroke-width="1" />{/each}
				<line x1={x(Math.min(ply, maxPly))} x2={x(Math.min(ply, maxPly))} y1="2" y2={height - 2} stroke="var(--accent)" stroke-width="1.5" vector-effect="non-scaling-stroke" />
				{#if hover !== undefined}<line x1={x(hover)} x2={x(hover)} y1="2" y2={height - 2} stroke="var(--text)" stroke-width="2" vector-effect="non-scaling-stroke" />{/if}
			{/if}
		</svg>
		{#if hover !== undefined && points.length}<span class="tooltip">{hoveredMove ? `${hoveredMove.san} · ${scoreText(hoveredMove.scoreAfter, hoveredMove.color === 'w' ? 'b' : 'w')}` : 'Starting position'}</span>{/if}
	</div>
	<div class="axis"><span>{points.length ? 'Start' : 'Evaluation unavailable'}</span><span>{total} plies</span></div>
</div>
<style>
	.graph {
		padding: 12px 14px 9px;
	}
	.heading,
	.axis {
		display: flex;
		justify-content: space-between;
		gap: 10px;
	}
	h2 {
		font-size: 14px;
	}
	.heading span,
	.axis {
		color: var(--text-2);
		font: 10px var(--mono);
	}
	.plot {
		position: relative;
		cursor: crosshair;
		touch-action: manipulation;
	}
	.plot:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	svg {
		display: block;
		width: 100%;
		height: 80px;
	}
	.tooltip {
		position: absolute;
		right: 0;
		top: 0;
		padding: 3px 6px;
		border-radius: var(--r-xs);
		background: var(--surface-4);
		font: 11px var(--mono);
		pointer-events: none;
	}
</style>
