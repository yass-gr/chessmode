<script lang="ts">
	import { untrack } from 'svelte';
	import { Crown } from '@lucide/svelte';
	import type { Classification } from '#lib/review/types.ts';
	import { reducedMotion } from '#lib/motion.ts';
	import LabelIcon from './LabelIcon.svelte';
	import { coachExpression, MASCOT_SRC, type CoachPhase, type CoachExpression, type RetryMood } from './coach.ts';

	let {
		phase,
		classification,
		retry,
		headline,
		detail,
		showMascot = true,
		size = 'compact'
	}: {
		phase: CoachPhase;
		classification?: Classification;
		retry?: RetryMood;
		headline: string;
		detail?: string;
		showMascot?: boolean;
		size?: 'compact' | 'large';
	} = $props();

	let failedSrc = $state('');
	const target = $derived(coachExpression(phase, classification, retry));
	// Shown face. The previous face stays underneath for one crossfade, then drops.
	let front = $state<CoachExpression>('neutral');
	let back = $state<CoachExpression | undefined>();

	$effect(() => {
		const next = target;
		if (reducedMotion()) {
			front = next;
			back = undefined;
			return;
		}
		const prev = untrack(() => front);
		if (prev === next) return;
		back = prev;
		front = next;
		// Same length as --dur-press, which drives the opacity crossfade.
		const timer = setTimeout(() => {
			back = undefined;
		}, 160);
		return () => clearTimeout(timer);
	});
</script>

<div class="coach" class:large={size === 'large'}>
	{#if showMascot}
		<div class="mascot">
			{#if back && MASCOT_SRC[back] !== failedSrc}
				<img class="under" src={MASCOT_SRC[back]} alt="" />
			{/if}
			{#if failedSrc === MASCOT_SRC[front]}
				<span class="placeholder" role="img" aria-label="Coach">
					<Crown size={20} stroke-width={1.75} />
				</span>
			{:else}
				{#key front}
					<img class:swap={back !== undefined} src={MASCOT_SRC[front]} alt="" onerror={() => { failedSrc = MASCOT_SRC[front]; }} />
				{/key}
			{/if}
		</div>
	{/if}
	{#key `${headline}\n${detail ?? ''}`}
		<div class="speech" aria-live="polite">
			<p class="headline">{#if phase === 'move' && classification}<span class="badge"><LabelIcon {classification} size={22} /></span>{/if}{headline}</p>
			{#if detail}<p>{detail}</p>{/if}
		</div>
	{/key}
</div>

<style>
	.coach {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		min-width: 0;
	}
	.mascot {
		position: relative;
		width: 56px;
		height: 56px;
		flex: 0 0 auto;
	}
	img,
	.placeholder {
		width: 56px;
		height: 56px;
		border-radius: 50%;
	}
	img {
		object-fit: cover;
		background: var(--surface-2);
	}
	img.under,
	img.swap,
	.mascot .placeholder {
		position: absolute;
		inset: 0;
	}
	img.swap {
		animation: coach-fade var(--dur-press) var(--ease-out);
	}
	.placeholder {
		display: grid;
		place-items: center;
		background: var(--surface-2);
		border: 1px solid var(--stroke);
		color: var(--text-3);
	}
	.placeholder :global(svg) {
		width: 20px;
		height: 20px;
	}
	.speech {
		min-width: 0;
		animation: coach-in var(--dur-press) var(--ease-out);
	}
	.badge {
		display: inline-block;
		margin-right: 8px;
		vertical-align: -5px;
	}
	.headline {
		margin: 0;
		color: var(--text);
		font-size: 16px;
		letter-spacing: -0.025em;
		line-height: 1.3;
	}
	p {
		margin: 4px 0 0;
		color: var(--text-2);
		font-size: 13px;
		line-height: 1.45;
	}
	@keyframes coach-in {
		from {
			opacity: 0;
			transform: translateX(12px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes coach-fade {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}
	@media (min-width: 1024px) {
		.mascot,
		img,
		.placeholder {
			width: 64px;
			height: 64px;
		}
		.placeholder :global(svg) {
			width: 20px;
			height: 20px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.speech,
		img.swap {
			animation: none;
		}
	}
</style>
