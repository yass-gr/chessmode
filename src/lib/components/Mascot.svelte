<script lang="ts" module>
	export type MascotExpression = 'neutral' | 'happy' | 'thinking' | 'wince' | 'celebrating' | 'encouraging' | 'full';

	const SRC: Record<MascotExpression, string> = {
		neutral: '/img/mascot/neutral.webp',
		happy: '/img/mascot/happy.webp',
		thinking: '/img/mascot/thinking.webp',
		wince: '/img/mascot/wince.webp',
		celebrating: '/img/mascot/celebrating.webp',
		encouraging: '/img/mascot/encouraging.webp',
		full: '/img/mascot/full.webp'
	};

	const ALT: Record<MascotExpression, string> = {
		neutral: 'Coach',
		happy: 'Coach, pleased',
		thinking: 'Coach, thinking',
		wince: 'Coach, wincing',
		celebrating: 'Coach, celebrating',
		encouraging: 'Coach, encouraging',
		full: 'Coach'
	};
</script>

<script lang="ts">
	let { expression = 'neutral', size = 40, alt }: { expression?: MascotExpression; size?: number; alt?: string } = $props();
	const label = $derived(alt ?? ALT[expression]);
</script>

{#key expression}
	<img
		class="mascot"
		src={SRC[expression]}
		alt={label}
		width={size}
		height={size}
		loading="lazy"
		decoding="async"
		style:width="{size}px"
		style:height="{size}px"
	/>
{/key}

<style>
	.mascot {
		display: block;
		object-fit: contain;
		flex: 0 0 auto;
		animation: mascot-in var(--dur-present) var(--ease-out) both;
	}
	@keyframes mascot-in {
		from {
			opacity: 0;
			transform: scale(0.92);
		}
	}
	@keyframes mascot-fade {
		from {
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.mascot {
			animation-name: mascot-fade;
			animation-duration: 0.2s;
		}
	}
</style>
