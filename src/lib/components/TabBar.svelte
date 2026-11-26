<script lang="ts">
	import { page } from '$app/state';
	import { tabs, tabForPath } from '#lib/nav.ts';
	import { BookOpen, Target, Zap, LineChart, UserRound } from '@lucide/svelte';
	const icons = [BookOpen, Target, Zap, LineChart, UserRound];

	const path = $derived(page.url.pathname);
</script>

<nav class="tabbar" aria-label="Main">
	{#each tabs as t, i (t.href)}
		{@const on = tabForPath(path) === t}
		{@const Icon = icons[i]}
		<a href={t.href} class:on aria-label={t.label} aria-current={on ? 'page' : undefined}>
			<span class="highlight" aria-hidden="true"></span>
			<Icon size={24} stroke-width={1.75} />
		</a>
	{/each}
</nav>

<style>
	.tabbar {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		bottom: calc(14px + var(--safe-bottom));
		width: auto;
		max-width: calc(100% - 24px);
		padding: 6px 12px;
		border-radius: 26px;
		background: rgba(29, 29, 31, 0.72);
		backdrop-filter: blur(20px) saturate(180%);
		-webkit-backdrop-filter: blur(20px) saturate(180%);
		border: 1px solid var(--stroke-2);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 20px 30px -16px rgba(0, 0, 0, 0.9);
		display: flex;
		gap: 10px;
		align-items: center;
		justify-content: center;
		z-index: 40;
	}
	a {
		position: relative;
		width: 56px;
		height: 48px;
		display: grid;
		place-items: center;
		color: var(--text-3);
		border-radius: 12px;
		transition: color 0.2s ease;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	a .highlight {
		position: absolute;
		inset: 4px 6px;
		border-radius: 12px;
		background: transparent;
		transition: background 0.2s ease;
	}
	a :global(svg) {
		position: relative;
		z-index: 1;
	}
	a.on { color: var(--accent-hi); }
	a.on .highlight { background: rgba(255, 255, 255, 0.12); }
	@media (min-width: 1024px) {
		.tabbar {
			display: none;
		}
	}
	@media (prefers-reduced-transparency: reduce) {
		.tabbar {
			background: var(--surface-2);
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
		}
	}
</style>