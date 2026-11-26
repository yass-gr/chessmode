<script lang="ts">
	import { page } from '$app/state';
	import { BookOpen, Target, Zap, LineChart, UserRound } from '@lucide/svelte';

	const tabs = [
		{ href: '/', label: 'Learn', match: (p: string) => p === '/' || p.startsWith('/course') || p.startsWith('/learn') || p.startsWith('/quiz'), Icon: BookOpen },
		{ href: '/practice', label: 'Practice', match: (p: string) => p.startsWith('/practice'), Icon: Target },
		{ href: '/drill', label: 'Drill', match: (p: string) => p.startsWith('/drill'), Icon: Zap },
		{ href: '/matches', label: 'Matches', match: (p: string) => p.startsWith('/matches') || p.startsWith('/review') || p.startsWith('/explorer') || p.startsWith('/analysis') || p.startsWith('/opening-review'), Icon: LineChart },
		{ href: '/you', label: 'You', match: (p: string) => p.startsWith('/you'), Icon: UserRound }
	];
</script>

<nav class="tabbar" aria-label="Main">
	{#each tabs as t (t.href)}
		{@const on = t.match(page.url.pathname)}
		<a href={t.href} class:on aria-label={t.label} aria-current={on ? 'page' : undefined}>
			<span class="highlight" aria-hidden="true"></span>
			<t.Icon size={20} stroke-width={1.75} />
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
		height: var(--tabbar-h);
		padding: 6px 8px;
		border-radius: 24px;
		background: rgba(29, 29, 31, 0.72);
		backdrop-filter: blur(20px) saturate(180%);
		-webkit-backdrop-filter: blur(20px) saturate(180%);
		border: 1px solid var(--stroke-2);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 20px 30px -16px rgba(0, 0, 0, 0.9);
		display: flex;
		gap: 4px;
		align-items: center;
		justify-content: center;
		z-index: 40;
	}
	a {
		position: relative;
		width: 44px;
		height: 44px;
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
		inset: 6px;
		border-radius: 10px;
		background: var(--surface-3, rgba(255, 255, 255, 0.08));
		opacity: 0;
		transition: opacity 0.2s ease;
		z-index: -1;
	}
	a.on { color: var(--accent-hi); }
	a.on .highlight { opacity: 1; }
	@media (prefers-reduced-transparency: reduce) {
		.tabbar {
			background: var(--surface-2);
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
		}
	}
</style>