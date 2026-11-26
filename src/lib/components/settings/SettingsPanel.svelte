<script lang="ts">
	import { onMount } from 'svelte';
	import MiniBoard from '#lib/components/MiniBoard.svelte';
	import { seg } from '#lib/components/seg.ts';
	import Switch from '#lib/components/Switch.svelte';
	import { START_FEN } from '#lib/chess/types.ts';
	import { boardColors, pieceLabel, themeLabel } from '#lib/settings/appearance.ts';
	import { readCoursePreferences, readPreferences, writeCoursePreferences, writePreferences } from '#lib/settings/preferences.ts';
	import {
		DEFAULT_COURSE_PREFERENCES,
		DEFAULT_PREFERENCES,
		PIECE_SETS,
		type BoardTheme,
		type CoursePreferences,
		type Preferences,
		type SettingsMode
	} from '#lib/settings/types.ts';
	import { setMuted } from '#lib/sound.ts';
	import '#lib/components/board-assets/pieces.css';

	let {
		mode,
		courseId,
		sharedStartAvailable = false,
		onchange
	}: {
		mode: SettingsMode;
		courseId: string;
		sharedStartAvailable?: boolean;
		onchange?: (preferences: Preferences, course: CoursePreferences) => void;
	} = $props();

	let preferences = $state<Preferences>({ ...DEFAULT_PREFERENCES });
	let course = $state<CoursePreferences>({ ...DEFAULT_COURSE_PREFERENCES });
	let ready = $state(false);
	const themes: BoardTheme[] = ['default', 'green', 'brown', 'blue', 'dark-blue'];
	const textSizes: { value: Preferences['textSize']; label: string }[] = [
		{ value: 'default', label: 'Default' },
		{ value: 'large', label: 'Large' },
		{ value: 'xl', label: 'Extra large' }
	];

	onMount(async () => {
		[preferences, course] = await Promise.all([readPreferences(), readCoursePreferences(courseId)]);
		ready = true;
		onchange?.(preferences, course);
	});

	let pending = Promise.resolve();
	function setPreference(key: 'evalBar' | 'autoNext' | 'sound' | 'confetti' | 'haptics', value: boolean) {
		preferences[key] = value;
		save();
	}
	function save() {
		const next = $state.snapshot(preferences);
		const nextCourse = $state.snapshot(course);
		const id = courseId;
		onchange?.(next, nextCourse);
		pending = pending.catch(() => {}).then(async () => {
			await writePreferences(next);
			await writeCoursePreferences(id, nextCourse);
			await setMuted(!next.sound);
		});
	}
</script>

<div class="settings" aria-label="Trainer settings">
	{#if mode === 'learn'}
		<label>
			Coaching
			<select bind:value={preferences.coaching} onchange={save}>
				<option value="default">Automatic</option>
				<option value="always">Every move</option>
				<option value="tap">On request</option>
			</select>
		</label>
	{/if}
	{#if mode === 'learn' || mode === 'practice'}
		<label>
			Move arrows
			<select bind:value={preferences.arrows} onchange={save}>
				<option value="none">None</option>
				<option value="withDialog">With coaching</option>
				<option value="always">Always</option>
			</select>
		</label>
	{/if}
	{#if mode !== 'puzzles'}
		<div class="toggle">
			<span>Evaluation bar</span>
			<Switch checked={preferences.evalBar} label="Evaluation bar" onchange={(value) => setPreference('evalBar', value)} />
		</div>
	{/if}
	{#if mode === 'drill' || mode === 'time'}
		<label><input type="checkbox" bind:checked={course.fastOpponent} onchange={save} /> Fast opponent</label>
	{/if}
	{#if sharedStartAvailable && (mode === 'learn' || mode === 'practice' || mode === 'drill')}
		<label>
			<input type="checkbox" bind:checked={course.skipSharedStart} onchange={save} />
			Skip shared start when available
		</label>
	{/if}
	{#if mode === 'puzzles'}
		<div class="toggle">
			<span>Next puzzle automatically</span>
			<Switch checked={preferences.autoNext} label="Next puzzle automatically" onchange={(value) => setPreference('autoNext', value)} />
		</div>
	{/if}
	<div class="toggle">
		<span>Sound</span>
		<Switch checked={preferences.sound} label="Sound" onchange={(value) => setPreference('sound', value)} />
	</div>
	<div class="toggle">
		<span>Confetti</span>
		<Switch checked={preferences.confetti} label="Confetti" onchange={(value) => setPreference('confetti', value)} />
	</div>
	<div class="toggle">
		<span>Haptics</span>
		<Switch checked={preferences.haptics} label="Haptics" onchange={(value) => setPreference('haptics', value)} />
	</div>
	<div class="text-size">
		<p class="label" id="text-size-label">Text size</p>
		<div class="seg" use:seg role="group" aria-labelledby="text-size-label">
			{#each textSizes as size (size.value)}
				<button type="button" aria-pressed={preferences.textSize === size.value} onclick={() => { preferences.textSize = size.value; save(); }}>{size.label}</button>
			{/each}
		</div>
	</div>

	<div class="preview" aria-hidden="true">
		<MiniBoard fen={START_FEN} size={200} theme={preferences.theme} pieces={preferences.pieces} />
	</div>

	<fieldset disabled={!ready}>
		<legend>Board color</legend>
		<div class="choices themes">
			{#each themes as theme (theme)}
				<button
					type="button"
					class:selected={preferences.theme === theme}
					aria-label={themeLabel[theme]}
					aria-pressed={preferences.theme === theme}
					onclick={() => {
						preferences.theme = theme;
						void save();
					}}
				>
					<MiniBoard fen={START_FEN} size={112} {theme} pieces={preferences.pieces} />
					<span>{themeLabel[theme]}</span>
				</button>
			{/each}
		</div>
	</fieldset>

	<fieldset disabled={!ready}>
		<legend>Pieces</legend>
		<div class="choices pieces">
			{#each PIECE_SETS as set (set)}
				<button
					type="button"
					class:selected={preferences.pieces === set}
					aria-label={pieceLabel[set]}
					aria-pressed={preferences.pieces === set}
					onclick={() => {
						preferences.pieces = set;
						void save();
					}}
				>
					<span class="samples piece-{set}" style:background={boardColors[preferences.theme][1]}>
						<piece class="knight white"></piece>
						<piece class="queen white"></piece>
						<piece class="king black"></piece>
						<piece class="pawn black"></piece>
					</span>
					<span>{pieceLabel[set]}</span>
				</button>
			{/each}
		</div>
	</fieldset>
</div>

<style>
	.settings {
		display: grid;
		gap: 12px;
	}
	label,
	.toggle {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.text-size {
		display: grid;
		gap: 8px;
	}
	.toggle {
		justify-content: space-between;
		gap: 12px;
	}
	select {
		margin-left: auto;
		background: var(--surface-2);
		color: var(--text);
		border: 1px solid var(--surface-4);
		border-radius: var(--r-sm);
		padding: 6px;
	}
	input {
		accent-color: var(--accent);
	}
	fieldset {
		border: 0;
		padding: 0;
		margin: 0;
	}
	legend {
		margin-bottom: 8px;
	}
	.preview {
		display: flex;
		justify-content: center;
	}
	.choices {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.choices button {
		display: grid;
		gap: 4px;
		justify-items: center;
		background: var(--surface-2);
		color: inherit;
		border: 1px solid transparent;
		border-radius: var(--r-sm);
		padding: 6px;
		font-size: 12px;
	}
	.choices button.selected {
		border-color: var(--accent);
	}
	.samples {
		display: flex;
		width: 100%;
		height: 40px;
		justify-content: center;
		border-radius: 6px;
		overflow: hidden;
	}
	.samples piece {
		position: relative;
		width: 40px;
		height: 40px;
		background-size: cover;
	}
	@media (min-width: 800px) {
		.choices.themes {
			grid-template-columns: repeat(5, minmax(0, 1fr));
		}
		.choices.pieces {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
	}
</style>
