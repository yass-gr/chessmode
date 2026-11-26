<script lang="ts">
	import type { Classification } from '#lib/review/types.ts';
	import { reducedMotion } from '#lib/motion.ts';
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

	let expression = $state<CoachExpression>('neutral');
	let failedSrc = $state('');
	const target = $derived(coachExpression(phase, classification, retry));
	const src = $derived(MASCOT_SRC[expression]);

	$effect(() => {
		const next = target;
		void headline;
		void detail;
		if (reducedMotion() || phase === 'loading') {
			expression = next;
			return;
		}
		expression = 'neutral';
		const timer = setTimeout(() => {
			expression = next;
		}, 200);
		return () => clearTimeout(timer);
	});
</script>

<div class="coach" class:large={size === 'large'}>
	{#if showMascot}
		{#if failedSrc === src}
			<span class="placeholder" role="img" aria-label="Coach"></span>
		{:else}
			<img src={src} alt="" onerror={() => { failedSrc = src; }} />
		{/if}
	{/if}
	{#key `${headline}\n${detail ?? ''}`}
		<div class="speech">
			<p class="headline">{headline}</p>
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
	img,
	.placeholder {
		width: 64px;
		height: 64px;
		flex: 0 0 auto;
		border-radius: 50%;
	}
	img {
		object-fit: cover;
		background: var(--surface-4);
	}
	.placeholder {
		display: block;
		background: var(--surface-4);
		border: 1px solid var(--stroke-2);
	}
	.large img,
	.large .placeholder {
		width: 96px;
		height: 96px;
	}
	.speech {
		min-width: 0;
		animation: coach-in 200ms var(--ease-out);
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
			transform: translateY(6px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.speech {
			animation: none;
		}
	}
</style>
