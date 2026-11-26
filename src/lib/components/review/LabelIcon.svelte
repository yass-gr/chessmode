<script lang="ts">
	import { CLASSIFICATIONS } from '#lib/review/classify.ts';
	import type { Classification } from '#lib/review/types.ts';
	let { classification, size = 20 }: { classification: Classification; size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class="icon">
	<circle cx="12" cy="12" r="11.5" fill={CLASSIFICATIONS[classification].color} stroke="rgba(0,0,0,.18)" />
	{#if classification === 'best'}
		<path d="m12 2.7 2.8 5.8 6.4.9-4.6 4.5 1.1 6.3L12 17.3l-5.7 2.9 1.1-6.3-4.6-4.5 6.4-.9z" />
	{:else if classification === 'strong'}
		<path d="M9 20H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h3l3.5-6.2c.5-.9 1.8-.9 2.2 0 .6 1.3.3 3-.3 4.7L13 10h5.4c1.6 0 2.6 1.4 2.2 2.9l-1.3 5.3c-.3 1.1-1.2 1.8-2.3 1.8H9zm-2-8v6h1v-6z" />
	{:else if classification === 'good'}
		<path d="m3.5 12 2.7-2.7 3.8 3.8 7.8-8 2.7 2.7L10 18.5z" />
	{:else if classification === 'book'}
		<path d="M2.8 5.1c3.3-.9 6.1-.5 8.4 1.2v13c-2.3-1.7-5.1-2.1-8.4-1.2zm18.4 0v13c-3.3-.9-6.1-.5-8.4 1.2v-13c2.3-1.7 5.1-2.1 8.4-1.2z" />
	{:else if classification === 'only'}
		<path d="M3 10h10V6l8 6-8 6v-4H3z" />
	{:else if classification === 'missed'}
		<path d="m6.3 3.8 5.7 5.7 5.7-5.7 2.5 2.5-5.7 5.7 5.7 5.7-2.5 2.5-5.7-5.7-5.7 5.7-2.5-2.5 5.7-5.7-5.7-5.7z" />
	{:else}
		<text x="12" y="18.4" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" textLength={classification === 'sharp' || classification === 'mistake' ? 9 : 18} lengthAdjust="spacingAndGlyphs" font-weight="900" letter-spacing={classification === 'sharp' || classification === 'mistake' ? 0 : -1.5} fill="white">{CLASSIFICATIONS[classification].glyph}</text>
	{/if}
</svg>
<style>
	.icon { display: block; flex: 0 0 auto; filter: drop-shadow(0 1px 2px rgba(0,0,0,.35)); }
	path { fill: white; }
</style>
