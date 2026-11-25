<script lang="ts">
	import { CLASSIFICATIONS } from '#lib/review/classify.ts';
	import type { Classification } from '#lib/review/types.ts';

	let { classification, named = false }: { classification: Classification; named?: boolean } = $props();
	const info = $derived(CLASSIFICATIONS[classification]);
</script>

<span class="label" title={info.label}>
	<span class="glyph" style:background={info.color} aria-hidden="true">{info.glyph}</span>
	{#if named}{info.label}{:else}<span class="sr">{info.label}</span>{/if}
</span>

<style>
	.label { display: inline-flex; align-items: center; gap: 7px; }
	.glyph { display: inline-grid; place-items: center; width: 23px; height: 23px; border-radius: 50%; flex: 0 0 auto; font: 750 11px/1 var(--mono); color: var(--bg); }
	.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
