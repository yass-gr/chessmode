<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Settings } from '@lucide/svelte';
	import { tabs, tabForPath } from '#lib/nav.ts';
	import { BookOpen, Target, Zap, LineChart, UserRound } from '@lucide/svelte';
	const icons = [BookOpen, Target, Zap, LineChart, UserRound];
	import { db } from '#lib/db.ts';
	import { streak } from '#lib/progress.ts';

	let days = $state<string[]>([]);
	onMount(() => {
		void db.sessions.toArray().then((sessions) => { days = sessions.map((session) => session.day); });
	});
	const streakDays = $derived(streak(days));
</script>

<header class="header">
	<div class="inner">
		<a class="brand" href="/"><img src="/img/icon-192.png" alt="" />Chessmode</a>
		<nav aria-label="Main">
			{#each tabs as tab, i (tab.href)}
				{@const Icon = icons[i]}
				<a href={tab.href} class:on={tabForPath(page.url.pathname) === tab} aria-current={tabForPath(page.url.pathname) === tab ? 'page' : undefined}>
					<Icon size={19} stroke-width={1.75} />{tab.label}
				</a>
			{/each}
		</nav>
		<a class="streak" href="/you" aria-label="{streakDays} day streak"><img src="/img/flame.webp" alt="" /><b>{streakDays}</b></a>
		<a class="settings" href="/you" aria-label="Profile and settings"><Settings size={20} /></a>
	</div>
</header>

<style>
	.header {
		display: none;
	}
	@media (min-width: 1024px) {
		.header {
			display: block;
			position: sticky;
			top: 0;
			z-index: 40;
			background: rgba(13, 13, 14, 0.86);
			backdrop-filter: blur(16px);
			-webkit-backdrop-filter: blur(16px);
			border-bottom: 1px solid var(--stroke);
		}
		.inner {
			max-width: 1200px;
			margin: auto;
			padding: 0 24px;
			height: 68px;
			display: flex;
			align-items: center;
			gap: 16px;
		}
		.brand {
			display: flex;
			align-items: center;
			gap: 9px;
			font-weight: 600;
			font-size: 17px;
			white-space: nowrap;
		}
		.brand img {
			width: 32px;
			height: 32px;
			border-radius: 8px;
		}
		nav {
			display: flex;
			align-items: center;
			gap: 2px;
			margin: 0 auto;
		}
		nav a {
			display: flex;
			align-items: center;
			gap: 7px;
			padding: 10px 12px;
			border-radius: var(--r-pill);
			color: var(--text-2);
			font-size: 14px;
			white-space: nowrap;
		}
		nav a:hover, nav a.on {
			background: var(--surface-3);
			color: #fff;
		}
		.streak, .settings {
			display: flex;
			align-items: center;
			justify-content: center;
			border: 1px solid var(--stroke);
			background: var(--surface-2);
			border-radius: var(--r-pill);
			height: 40px;
		}
		.streak {
			padding: 0 12px 0 6px;
		}
		.streak img {
			width: 28px;
			height: 28px;
			object-fit: contain;
		}
		.settings {
			width: 40px;
		}
	}
</style>
