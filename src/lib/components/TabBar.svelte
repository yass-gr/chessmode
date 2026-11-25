<script lang="ts">
	import { page } from '$app/state';

	const tabs = [
		{ href: '/', label: 'Learn', match: (p: string) => p === '/' || p.startsWith('/course') || p.startsWith('/learn') || p.startsWith('/quiz'), icon: 'M4 11l8-7 8 7v9h-5v-6H9v6H4z' },
		{ href: '/practice', label: 'Practice', match: (p: string) => p.startsWith('/practice'), icon: 'M4 4h16v16H4zM4 12h16M12 4v16' },
		{ href: '/drill', label: 'Drill', match: (p: string) => p.startsWith('/drill'), icon: 'M13 3L5 14h6l-1 7 8-11h-6z' },
		{ href: '/matches', label: 'Matches', match: (p: string) => p.startsWith('/matches') || p.startsWith('/review'), icon: 'M3 17l5-6 4 4 8-9M14 6h6v6' },
		{ href: '/you', label: 'You', match: (p: string) => p.startsWith('/you'), icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6' }
	];
</script>

<nav class="tabbar" aria-label="Main">
	{#each tabs as t (t.href)}
		{@const on = t.match(page.url.pathname)}
		<a href={t.href} class:on aria-current={on ? 'page' : undefined}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={t.icon} /></svg>
			{t.label}
		</a>
	{/each}
</nav>

<style>
	.tabbar {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		bottom: calc(14px + var(--safe-bottom));
		width: min(calc(100% - 24px), 520px);
		height: var(--tabbar-h);
		border-radius: 24px;
		background: rgba(29, 29, 31, 0.72);
		backdrop-filter: blur(20px) saturate(180%);
		-webkit-backdrop-filter: blur(20px) saturate(180%);
		border: 1px solid var(--stroke-2);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.06),
			0 20px 30px -16px rgba(0, 0, 0, 0.9);
		display: flex;
		justify-content: space-around;
		align-items: center;
		z-index: 40;
	}
	a {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		font-size: 10px;
		font-weight: 500;
		color: var(--text-3);
		padding: 8px 0;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
		transition: color 0.2s ease;
	}
	a svg {
		width: 22px;
		height: 22px;
		transition: transform var(--dur-press) var(--ease-out);
	}
	a:active svg {
		transform: scale(0.86);
	}
	@media (prefers-reduced-transparency: reduce) {
		.tabbar {
			background: var(--surface-2);
			backdrop-filter: none;
			-webkit-backdrop-filter: none;
		}
	}
	a.on {
		color: var(--accent-hi);
	}
</style>
