<script lang="ts">
	import { CLASSIFICATIONS } from '#lib/review/classify.ts';
	import type { Classification } from '#lib/review/types.ts';
	let { classification, size = 20 }: { classification: Classification; size?: number } = $props();
	// Gradient ids must be unique per instance or every badge paints with the first one's colour.
	const uid = $props.id();
	const color = $derived(CLASSIFICATIONS[classification].color);
	const shade = $derived(`${uid}-shade`);
	const rim = $derived(`${uid}-rim`);
</script>

{#snippet exclaim(x: number)}
	<path d="M{x} 7.5v5.4" stroke-width="2.7" />
	<circle cx={x} cy="16.4" r="1.5" />
{/snippet}

{#snippet question(x: number)}
	<path d="M{x - 2.6} 9.3c0-1.6 1.2-2.7 2.7-2.7s2.7 1.1 2.7 2.5c0 1.1-.7 1.7-1.6 2.2-.8.4-1.1.9-1.1 1.6v.4" stroke-width="2.4" />
	<circle cx={x} cy="16.5" r="1.45" />
{/snippet}

{#snippet glyph()}
	{#if classification === 'find'}
		{@render exclaim(9.6)}{@render exclaim(14.4)}
	{:else if classification === 'sharp'}
		{@render exclaim(12)}
	{:else if classification === 'best'}
		<path class="fill" d="M12 6.5 13.5 10.34 17.61 10.58 14.43 13.19 15.47 17.17 12 14.95 8.53 17.17 9.57 13.19 6.39 10.58 10.5 10.34Z" stroke-width="1.2" />
	{:else if classification === 'strong'}
		<g transform="translate(12 12) scale(.56) translate(-12 -12.4)"><path class="fill" stroke="none" d="M9 20H5a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2h3l3.5-6.2c.5-.9 1.8-.9 2.2 0 .6 1.3.3 3-.3 4.7L13 10h5.4c1.6 0 2.6 1.4 2.2 2.9l-1.3 5.3c-.3 1.1-1.2 1.8-2.3 1.8H9zm-2-8v6h1v-6z" /></g>
	{:else if classification === 'good'}
		<path d="m7.7 12.3 2.9 2.9 5.7-6.1" stroke-width="2.7" />
	{:else if classification === 'book'}
		<g transform="translate(12 12) scale(.6) translate(-12 -12.2)"><path class="fill" stroke="none" d="M2.8 5.1c3.3-.9 6.1-.5 8.4 1.2v13c-2.3-1.7-5.1-2.1-8.4-1.2zm18.4 0v13c-3.3-.9-6.1-.5-8.4 1.2v-13c2.3-1.7 5.1-2.1 8.4-1.2z" /></g>
	{:else if classification === 'only'}
		<path d="M7.4 12h8.6M12.7 8.6l3.4 3.4-3.4 3.4" stroke-width="2.5" />
	{:else if classification === 'missed'}
		<path d="m8.9 8.9 6.2 6.2m0-6.2-6.2 6.2" stroke-width="2.7" />
	{:else if classification === 'loose'}
		<g transform="translate(12 12) scale(.84) translate(-12 -12)">{@render question(9.4)}</g>
		<g transform="translate(12 12) scale(.9) translate(-12 -12)">{@render exclaim(16.2)}</g>
	{:else if classification === 'mistake'}
		{@render question(12.1)}
	{:else}
		<g transform="translate(12 12) scale(.78) translate(-12 -12)">{@render question(8.6)}{@render question(15.9)}</g>
	{/if}
{/snippet}

<svg class="icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
	<defs>
		<radialGradient id={shade} cx="38%" cy="28%" r="78%">
			<stop offset="0" stop-color="#fff" stop-opacity=".34" />
			<stop offset=".45" stop-color="#fff" stop-opacity="0" />
			<stop offset=".78" stop-color="#000" stop-opacity=".06" />
			<stop offset="1" stop-color="#000" stop-opacity=".3" />
		</radialGradient>
		<linearGradient id={rim} x1="0" y1="0" x2="0" y2="1">
			<stop offset="0" stop-color="#fff" stop-opacity=".5" />
			<stop offset=".5" stop-color="#fff" stop-opacity=".05" />
			<stop offset="1" stop-color="#000" stop-opacity=".38" />
		</linearGradient>
	</defs>
	<circle cx="12" cy="12" r="11.2" fill={color} />
	<circle cx="12" cy="12" r="11.2" fill="url(#{shade})" />
	<ellipse cx="12" cy="6.9" rx="6.4" ry="3.3" fill="#fff" opacity=".16" />
	<circle cx="12" cy="12" r="10.55" fill="none" stroke="url(#{rim})" stroke-width="1.3" />
	<g class="glyph emboss" transform="translate(0 .75)">{@render glyph()}</g>
	<g class="glyph">{@render glyph()}</g>
</svg>

<style>
	.icon {
		display: block;
		flex: 0 0 auto;
		overflow: visible;
		filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.45));
	}
	.glyph {
		color: #fff;
		fill: currentColor;
		stroke: currentColor;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.glyph :global(path:not(.fill)) {
		fill: none;
	}
	.emboss {
		color: rgba(0, 0, 0, 0.26);
	}
</style>
