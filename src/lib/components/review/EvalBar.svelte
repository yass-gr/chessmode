<script lang="ts">
	import type { Color } from '#lib/chess/types.ts';
	import type { GameRecord, Score } from '#lib/review/types.ts';
	import { scoreText, whiteFill } from './evaluation.ts';

	let { score, turn = 'w', orientation = 'w', result, loading = false }: {
		score?: Score; turn?: Color; orientation?: Color; result?: GameRecord['result']; loading?: boolean;
	} = $props();
	const fill = $derived(whiteFill(score, turn, result));
	const text = $derived(scoreText(score, turn, result));
	const whiteAdvantage = $derived(fill >= 50);
</script>

<div class:flipped={orientation === 'b'} class:loading class="bar" role="img" aria-label={score || (result && result !== '*') ? `Evaluation ${text}, White ${Math.round(fill)} percent` : 'Evaluation unavailable'} title={score || result ? `Evaluation: ${text}` : 'Evaluation unavailable'}>
	<div class="white" style:height={`${fill}%`}></div>
	<span class:white-label={whiteAdvantage} class:black-label={!whiteAdvantage}>{text}</span>
</div>

<style>
	.bar {
		position: relative;
		width: 28px;
		height: 100%;
		min-height: 120px;
		overflow: hidden;
		border-radius: var(--r-xs);
		background: var(--eval-black);
	}
	.white {
		position: absolute;
		bottom: 0;
		width: 100%;
		background: var(--eval-white);
		transition: height 1s ease-in;
	}
	.loading .white {
		transition: height 100ms cubic-bezier(0, 0, 0.4, 1);
	}
	.flipped .white {
		bottom: auto;
		top: 0;
	}
	span {
		position: absolute;
		left: 0;
		width: 100%;
		padding: 5px 1px;
		text-align: center;
		font: 700 10px var(--mono);
	}
	.white-label {
		bottom: 0;
		color: var(--eval-white-ink);
	}
	.black-label {
		top: 0;
		color: var(--eval-black-ink);
	}
	.flipped .white-label {
		top: 0;
		bottom: auto;
	}
	.flipped .black-label {
		bottom: 0;
		top: auto;
	}
	@media (prefers-reduced-motion: reduce) {
		.white,
		.loading .white {
			transition: none;
		}
	}
</style>
