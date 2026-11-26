<script lang="ts">
	import Sheet from '#lib/components/Sheet.svelte';
	import { seg } from '#lib/components/seg.ts';
	import { DEPTHS, type ReviewDepth } from '#lib/review/analyse.ts';
	import type { ReviewOverlays, ReviewPerspective, ReviewPreferences } from '#lib/settings/types.ts';

	let {
		prefs,
		depth,
		depthDisabled,
		onclose,
		onperspective,
		onoverlays,
		ondepth,
		onvoice,
		oncoach,
		onglyphs
	}: {
		prefs: ReviewPreferences;
		depth: ReviewDepth;
		depthDisabled: boolean;
		onclose: () => void;
		onperspective: (value: ReviewPerspective) => void;
		onoverlays: (value: ReviewOverlays) => void;
		ondepth: (value: ReviewDepth) => void;
		onvoice: () => void;
		oncoach: () => void;
		onglyphs: () => void;
	} = $props();

	const sides: { value: ReviewPerspective; label: string }[] = [
		{ value: 'w', label: 'White' },
		{ value: 'b', label: 'Black' },
		{ value: 'both', label: 'Both' }
	];
	const arrows: { value: ReviewOverlays; label: string }[] = [
		{ value: 'both', label: 'Both' },
		{ value: 'played', label: 'Played' },
		{ value: 'best', label: 'Best' },
		{ value: 'none', label: 'Off' }
	];
</script>

<Sheet labelledby="review-settings-title" ondismiss={onclose}>
	<div class="settings">
		<h2 id="review-settings-title" class="h-title">Review settings</h2>

		<div>
			<p class="label" id="review-side-label">Side</p>
			<div class="seg" use:seg role="group" aria-labelledby="review-side-label">
				{#each sides as side (side.value)}
					<button type="button" aria-pressed={prefs.perspective === side.value} onclick={() => onperspective(side.value)}>{side.label}</button>
				{/each}
			</div>
		</div>

		<div>
			<p class="label" id="review-arrows-label">Arrows</p>
			<div class="seg arrows" use:seg role="group" aria-labelledby="review-arrows-label">
				{#each arrows as arrow (arrow.value)}
					<button type="button" aria-pressed={prefs.overlays === arrow.value} onclick={() => onoverlays(arrow.value)}>{arrow.label}</button>
				{/each}
			</div>
		</div>

		<div>
			<p class="label" id="review-depth-label">Depth</p>
			<div class="seg" use:seg role="group" aria-labelledby="review-depth-label">
				{#each DEPTHS as option (option.value)}
					<button type="button" aria-pressed={depth === option.value} disabled={depthDisabled} onclick={() => ondepth(option.value)}>{option.label}</button>
				{/each}
			</div>
			{#if depthDisabled}<p class="muted note">Depth stays put during a line or a retry.</p>{/if}
		</div>

		<div class="toggles" role="group" aria-label="Coach options">
			<button type="button" class="toggle" aria-pressed={prefs.voice} onclick={onvoice}>
				<span>Voice</span>
				<b>{prefs.voice ? 'On' : 'Off'}</b>
			</button>
			<button type="button" class="toggle" aria-pressed={prefs.coach} onclick={oncoach}>
				<span>Coach</span>
				<b>{prefs.coach ? 'On' : 'Off'}</b>
			</button>
			<button type="button" class="toggle" aria-pressed={prefs.glyphs} onclick={onglyphs}>
				<span>Badges</span>
				<b>{prefs.glyphs ? 'On' : 'Off'}</b>
			</button>
		</div>

		<button class="btn btn-surface block" type="button" onclick={onclose}>Done</button>
	</div>
</Sheet>

<style>
	.settings {
		display: grid;
		gap: 16px;
	}
	h2 {
		margin-bottom: 2px;
	}
	.label {
		margin-bottom: 6px;
	}
	.arrows button {
		font-size: 13px;
		padding: 0 6px;
	}
	.note {
		margin-top: 6px;
		font-size: 12px;
	}
	.toggles {
		display: grid;
		gap: 8px;
	}
	.toggle {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		min-height: 52px;
		padding: 0 16px;
		border-radius: var(--r-md);
		background: var(--surface-1);
		border: 1px solid var(--stroke);
		box-shadow: var(--d-surface);
		font-size: 15px;
	}
	.toggle b {
		font: 600 13px var(--mono);
		color: var(--text-2);
	}
	.toggle[aria-pressed='true'] {
		border-color: var(--accent-line);
		background: var(--accent-soft);
	}
	.toggle[aria-pressed='true'] b {
		color: var(--accent-hi);
	}
</style>
