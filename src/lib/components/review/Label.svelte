<script lang="ts">
	import LabelIcon from '#lib/components/review/LabelIcon.svelte';
	import { CLASSIFICATIONS } from '#lib/review/classify.ts';
	import type { Classification } from '#lib/review/types.ts';

	let { classification, named = false, size = 22 }: { classification: Classification; named?: boolean; size?: number } = $props();
	const info = $derived(CLASSIFICATIONS[classification]);
</script>

<span class="label" title={info.label} style:color={named ? info.color : undefined}>
	<LabelIcon {classification} {size} />
	{#if named}{info.label}{:else}<span class="sr">{info.label}</span>{/if}
</span>

<style>
	.label { display: inline-flex; align-items: center; gap: 7px; color: var(--text); font: 600 14px var(--font); }
	.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
