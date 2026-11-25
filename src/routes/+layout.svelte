<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { onNavigate } from '$app/navigation';
	import TabBar from '#lib/components/TabBar.svelte';
	import { isImmersive, navKind } from '#lib/motion.ts';

	let { children } = $props();

	const immersive = $derived(isImmersive(page.url.pathname));

	/** Safari animates its own edge-swipe back; animating the pop again would play it twice. */
	let edgeSwipeAt = 0;
	onMount(() => {
		// A touchstart listener is also what lets iOS Safari apply :active on touch-down.
		const touch = (e: TouchEvent) => {
			const x = e.touches[0]?.clientX ?? innerWidth / 2;
			if (x < 24 || x > innerWidth - 24) edgeSwipeAt = Date.now();
		};
		document.addEventListener('touchstart', touch, { passive: true });
		return () => document.removeEventListener('touchstart', touch);
	});

	let transitionId = 0;
	onNavigate((nav) => {
		if (!document.startViewTransition || !nav.from || !nav.to) return;
		const kind = navKind(nav.from.url.pathname, nav.to.url.pathname, nav.type === 'popstate' ? nav.delta : undefined);
		if (kind === 'none') return;
		if (nav.type === 'popstate' && Date.now() - edgeSwipeAt < 1000) return;

		const root = document.documentElement;
		const id = ++transitionId;
		root.dataset.nav = kind;
		return new Promise<void>((resolve) => {
			const transition = document.startViewTransition(async () => {
				resolve();
				await nav.complete;
			});
			transition.finished.finally(() => {
				if (id === transitionId) delete root.dataset.nav;
			});
		});
	});
</script>

<svelte:head>
	<title>Chessmode</title>
</svelte:head>

{@render children()}

{#if !immersive}
	<TabBar />
{/if}
