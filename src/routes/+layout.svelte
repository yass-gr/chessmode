<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import TabBar from '#lib/components/TabBar.svelte';

	let { children } = $props();

	/** Full-screen flows (a lesson, a review) hide the tab bar. */
	const immersive = $derived(/^\/(learn|practice\/run|drill\/run|quiz|review)\b/.test(page.url.pathname));
</script>

<svelte:head>
	<title>Chessmode</title>
</svelte:head>

{@render children()}

{#if !immersive}
	<TabBar />
{/if}
