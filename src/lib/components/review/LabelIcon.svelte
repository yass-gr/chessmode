<script lang="ts">
	import { CLASSIFICATIONS } from '#lib/review/classify.ts';
	import type { Classification } from '#lib/review/types.ts';
	let { classification, size = 20 }: { classification: Classification; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class="icon">
	<circle cx="12" cy="12" r="12" fill={CLASSIFICATIONS[classification].color} />
	{#if classification === 'best'}
		<path d="m12 3 2.6 5.5 6 .8-4.4 4.2 1.1 6L12 16.6 6.7 19.5l1.1-6L3.4 9.3l6-.8z" fill="#111" />
	{:else if classification === 'good'}
		<path d="m6 12 4 4 8-8" />
	{:else if classification === 'strong'}
		<path d="m3 12 3.5 3.5L13 8M10 12l3.5 3.5L21 8" />
	{:else if classification === 'book'}
		<path d="M12 18c-2-2-4-2.5-7-2V6c3-.5 5 0 7 2m0 10c2-2 4-2.5 7-2V6c-3-.5-5 0-7 2m0 0v10" />
	{:else if classification === 'only'}
		<path d="M5 12h13m-5-5 5 5-5 5" />
	{:else if classification === 'missed'}
		<path d="m7 7 10 10M17 7 7 17" />
	{:else}
		<text x="12" y="17" text-anchor="middle" font-family="system-ui, sans-serif" font-size={classification === 'sharp' || classification === 'mistake' ? 17 : 12} font-weight="900" fill="#111">{CLASSIFICATIONS[classification].glyph}</text>
	{/if}
</svg>
<style>
	.icon { display: block; flex: 0 0 auto; filter: drop-shadow(0 2px 2px rgba(0,0,0,.4)); }
	path:not([fill]) { fill: none; stroke: #111; stroke-width: 2.6; stroke-linecap: round; stroke-linejoin: round; }
</style>
