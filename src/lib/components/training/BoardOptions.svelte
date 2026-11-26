<script lang="ts">
	import { onMount } from 'svelte';
	import { pieceLabel, themeLabel } from '#lib/settings/appearance.ts';
	import { readPreferences, writePreferences } from '#lib/settings/preferences.ts';
	import { DEFAULT_PREFERENCES, PIECE_SETS, type BoardTheme, type PieceSet, type Preferences } from '#lib/settings/types.ts';
	import { setMuted } from '#lib/sound.ts';

	let { onchange }: { onchange?: (preferences: Preferences) => void } = $props();
	let preferences = $state<Preferences>({ ...DEFAULT_PREFERENCES });
	const themes: BoardTheme[] = ['default', 'green', 'brown', 'blue', 'dark-blue'];

	onMount(async () => {
		preferences = await readPreferences();
		onchange?.(preferences);
	});

	function save() {
		const next = $state.snapshot(preferences);
		onchange?.(next);
		void writePreferences(next).then(() => setMuted(!next.sound));
	}
</script>

<div class="options">
	<p class="label">Board</p>
	<div class="choices" role="group" aria-label="Board colors">
		{#each themes as theme (theme)}
			<button class="chip" class:accent={preferences.theme === theme} aria-pressed={preferences.theme === theme} onclick={() => { preferences.theme = theme; save(); }}>{themeLabel[theme]}</button>
		{/each}
	</div>
	<p class="label">Pieces</p>
	<div class="choices" role="group" aria-label="Piece set">
		{#each PIECE_SETS as set (set)}
			<button class="chip" class:accent={preferences.pieces === set} aria-pressed={preferences.pieces === set} onclick={() => { preferences.pieces = set as PieceSet; save(); }}>{pieceLabel[set]}</button>
		{/each}
	</div>
	<button class="chip" class:accent={preferences.sound} aria-pressed={preferences.sound} onclick={() => { preferences.sound = !preferences.sound; save(); }}>
		{preferences.sound ? 'Sound on' : 'Sound off'}
	</button>
</div>

<style>
	.options {
		display: grid;
		gap: 8px;
	}
	.choices {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
</style>
