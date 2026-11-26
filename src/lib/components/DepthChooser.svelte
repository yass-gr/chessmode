<script lang="ts">
	import Sheet from '#lib/components/Sheet.svelte';
	import { tierBlurb } from '#lib/courses/scope.ts';
	import type { DepthTier } from '#lib/courses/depth.ts';

	let {
		tiers,
		preview,
		onpreview,
		onconfirm,
		ondismiss
	}: {
		tiers: DepthTier[];
		preview: number;
		onpreview: (tier: number) => void;
		onconfirm: () => void;
		ondismiss: () => void;
	} = $props();

	const selected = $derived(tiers[preview] ?? tiers[0]);
</script>

<Sheet labelledby="depth-title" {ondismiss}>
	<h2 class="h-title" id="depth-title">Choose your depth</h2>
	<p class="muted intro">Choose how many lines to focus on. You can change this later.</p>
	<div class="tiers">
		{#each tiers as tier, i (tier.name)}
			<button
				class="option tier"
				class:selected={preview === i}
				aria-pressed={preview === i}
				onclick={() => onpreview(i)}
			>
				<span class="copy">
					<span class="name">
						<b>{tier.name}</b>
						{#if i === 0}<span class="chip">Recommended</span>{/if}
					</span>
					<span class="desc">{tierBlurb(tier.name)}</span>
				</span>
				<span class="count">{tier.count} lines</span>
			</button>
		{/each}
	</div>
	<button class="btn btn-primary block" onclick={onconfirm}>Start with {selected.name}</button>
	<button class="btn btn-surface block" onclick={ondismiss}>Not now</button>
</Sheet>

<style>
	.intro {
		margin-top: 6px;
	}
	.tiers {
		display: grid;
		gap: 10px;
		margin: 16px 0;
	}
	.tier {
		align-items: center;
		justify-content: space-between;
	}
	.copy {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.name {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.desc {
		color: var(--text-3);
		font-size: 13px;
		line-height: 1.3;
	}
	.count {
		color: var(--text-2);
		font-size: 13px;
		white-space: nowrap;
	}
	.tier.selected .desc,
	.tier.selected .count {
		color: var(--text-2);
	}
	.tier.selected:focus,
	.tier.selected:focus-visible {
		outline: none;
	}
	.btn {
		margin-top: 10px;
	}
</style>
