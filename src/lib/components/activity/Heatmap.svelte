<script lang="ts">
	import { onMount } from 'svelte';
	import type { HeatDay } from '#lib/activity/types.ts';

	let { days }: { days: HeatDay[] } = $props();
	let selected = $state<string | null>(null);
	let scroller = $state<HTMLDivElement | undefined>();

	const columns = $derived.by(() => {
		const weeks: HeatDay[][] = [];
		for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
		return weeks;
	});
	const active = $derived(days.find((day) => day.day === selected) ?? days[days.length - 1]);

	const dayFormat = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
	const monthFormat = new Intl.DateTimeFormat(undefined, { month: 'short' });

	function spoken(day: HeatDay | undefined): string {
		if (!day) return 'No training yet';
		const [year, month, date] = day.day.split('-').map(Number);
		const formatted = dayFormat.format(new Date(year, month - 1, date, 12));
		const reps = day.reps === 1 ? '1 rep' : `${day.reps} reps`;
		return `${formatted}, ${reps}`;
	}

	function monthName(day: string): string {
		const [year, month] = day.split('-').map(Number);
		return monthFormat.format(new Date(year, month - 1, 1, 12));
	}

	onMount(() => {
		const node = scroller;
		if (!node) return;
		const showToday = () => {
			node.scrollLeft = node.scrollWidth;
		};
		showToday();
		requestAnimationFrame(showToday);
	});
</script>

<div class="heat">
	<div class="scroll" bind:this={scroller} role="group" aria-label="Training activity for the past year">
		<div class="grid">
			{#each columns as column, index (column[0].day)}
				{@const month = column[0].day.slice(0, 7)}
				<div class="week">
					<span class="month">{month === columns[index - 1]?.[0]?.day.slice(0, 7) ? '' : monthName(column[0].day)}</span>
					{#each column as day, row (day.day)}
						{@const label = spoken(day)}
						<button
							type="button"
							class="cell band-{day.band}"
							class:on={active?.day === day.day}
							style:grid-row={row + 2}
							aria-label={label}
							aria-pressed={active?.day === day.day}
							title={label}
							onclick={() => (selected = day.day)}
							onfocus={() => (selected = day.day)}
						></button>
					{/each}
				</div>
			{/each}
		</div>
	</div>
	<div class="legend" aria-hidden="true">
		<span>Less</span>
		{#each [0, 1, 2, 3, 4] as band (band)}<i class="swatch band-{band}"></i>{/each}
		<span>More</span>
	</div>
	<p class="detail" aria-live="polite">{spoken(active)}</p>
</div>

<style>
	.heat {
		display: grid;
		min-width: 0;
		gap: 10px;
	}
	.scroll {
		min-width: 0;
		max-width: 100%;
		overflow-x: auto;
		overscroll-behavior-x: contain;
		padding-bottom: 2px;
	}
	.grid {
		display: flex;
		gap: 3px;
		width: max-content;
	}
	.week {
		display: grid;
		grid-template-columns: 16px;
		grid-template-rows: 16px repeat(7, 16px);
		gap: 3px;
	}
	.month {
		font-size: 10px;
		line-height: 16px;
		color: var(--text-3);
	}
	.cell,
	.swatch {
		width: 16px;
		height: 16px;
		border-radius: 4px;
		padding: 0;
	}
	.cell {
		transition: box-shadow var(--dur-press) var(--ease-out);
	}
	.cell.on {
		box-shadow: inset 0 0 0 1.5px var(--text);
	}
	.band-0 {
		background: var(--surface-3);
	}
	.band-1 {
		background: rgba(255, 107, 44, 0.32);
	}
	.band-2 {
		background: rgba(255, 107, 44, 0.52);
	}
	.band-3 {
		background: rgba(255, 107, 44, 0.74);
	}
	.band-4 {
		background: var(--accent);
	}
	.legend {
		display: flex;
		align-items: center;
		gap: 4px;
		font-size: 11px;
		color: var(--text-3);
	}
	.detail {
		font-size: 14px;
		color: var(--text-2);
	}
	@media (prefers-reduced-motion: reduce) {
		.cell {
			transition: none;
		}
	}
</style>
