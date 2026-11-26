<script lang="ts">
	import { CLASSIFICATIONS } from '#lib/review/classify.ts';
	import type { Classification } from '#lib/review/types.ts';
	let { classification, size = 20 }: { classification: Classification; size?: number } = $props();
	const id = $props.id();
	let color = $derived(CLASSIFICATIONS[classification].color);
</script>

<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" class="icon">
	<defs>
		<linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
			<stop stop-color={color} /><stop offset="1" stop-color="#202020" />
		</linearGradient>
		<radialGradient id={`${id}-body`} cx="30%" cy="18%" r="90%">
			<stop stop-color="white" stop-opacity=".38" /><stop offset=".55" stop-color="white" stop-opacity="0" /><stop offset="1" stop-color="black" stop-opacity=".18" />
		</radialGradient>
		<g id={`${id}-glyph`} stroke-linecap="round" stroke-linejoin="round">
			{#if classification === 'find'}
				<path d="M8 6v8m8-8v8" /><circle cx="8" cy="18" r="1.3" /><circle cx="16" cy="18" r="1.3" />
			{:else if classification === 'sharp'}
				<path d="M12 6v8" /><circle cx="12" cy="18" r="1.3" />
			{:else if classification === 'best'}
				<path fill="currentColor" d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z" />
			{:else if classification === 'strong'}
				<path fill="currentColor" d="M9 19H6a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h3l3-6c.5-1 2-1 2.3.2.3 1.3-.1 2.8-.6 4.3l-.2.5H18c1.2 0 1.8.9 1.5 2l-1.2 5.4c-.2 1-1 1.6-2 1.6z" />
			{:else if classification === 'good'}
				<path d="m5 12 4.5 4.5L19 7" />
			{:else if classification === 'book'}
				<path d="M4 6c3-.8 5.5-.3 8 1.4v11c-2.5-1.7-5-2.2-8-1.4zM20 6c-3-.8-5.5-.3-8 1.4v11c2.5-1.7 5-2.2 8-1.4z" />
			{:else if classification === 'only'}
				<path d="M4 12h15m-6-6 6 6-6 6" />
			{:else if classification === 'loose'}
				<path d="M4.5 8a3.2 3.2 0 1 1 5.1 2.6c-1.2.8-1.7 1.5-1.7 3M16 6v8" /><circle cx="8" cy="18" r="1.3" /><circle cx="16" cy="18" r="1.3" />
			{:else if classification === 'mistake'}
				<path d="M8.5 8a3.5 3.5 0 1 1 5.3 3c-1.3.8-1.8 1.5-1.8 3" /><circle cx="12" cy="18" r="1.3" />
			{:else if classification === 'missed'}
				<path d="m7 7 10 10M17 7 7 17" />
			{:else}
				<path d="M3.8 8a3 3 0 1 1 4.7 2.5c-1.1.8-1.5 1.6-1.5 3.5M13 8a3 3 0 1 1 4.7 2.5c-1.1.8-1.5 1.6-1.5 3.5" /><circle cx="7" cy="18" r="1.3" /><circle cx="16.2" cy="18" r="1.3" />
			{/if}
		</g>
	</defs>
	<circle cx="12" cy="12" r="11.5" fill={`url(#${id}-rim)`} />
	<circle cx="12" cy="11.4" r="9.7" fill={color} />
	<circle cx="12" cy="11.4" r="9.7" fill={`url(#${id}-body)`} />
	<ellipse cx="12" cy="6.8" rx="7.4" ry="3.4" fill="white" opacity=".27" />
	<g transform="translate(4.2 4.2) scale(.65)" fill="none" stroke-width="2.8">
		<use href={`#${id}-glyph`} transform="translate(0 1)" color="#000" stroke="#000" opacity=".25" />
		<use href={`#${id}-glyph`} color="white" stroke="white" />
	</g>
</svg>
<style>
	.icon { display: block; flex: 0 0 auto; filter: drop-shadow(0 1px 1px rgba(0,0,0,.5)); }
</style>
