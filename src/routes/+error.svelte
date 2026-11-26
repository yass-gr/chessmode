<script lang="ts">
	import { page } from '$app/state';
	import Mascot from '#lib/components/Mascot.svelte';

	const missing = $derived(page.status === 404);
</script>

<svelte:head><title>{missing ? 'Page not found' : 'Something went wrong'} · Chessmode</title></svelte:head>

<main class="page miss">
	<Mascot expression={missing ? 'thinking' : 'encouraging'} size={120} />
	<p class="h-title">{missing ? 'That page is not here.' : 'Something went wrong.'}</p>
	<a class="btn btn-primary" href="/">Home</a>
</main>

<style>
	.miss {
		min-height: 70dvh;
		display: grid;
		justify-items: center;
		align-content: center;
		gap: 16px;
		text-align: center;
	}
</style>
