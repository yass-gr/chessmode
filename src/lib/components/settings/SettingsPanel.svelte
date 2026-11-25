<script lang="ts">
 import { onMount } from 'svelte';
 import MiniBoard from '#lib/components/MiniBoard.svelte';
 import { START_FEN } from '#lib/chess/types.ts';
 import { readPreferences, writePreferences, readCoursePreferences, writeCoursePreferences } from '#lib/settings/preferences.ts';
 import { DEFAULT_PREFERENCES, DEFAULT_COURSE_PREFERENCES, type Preferences, type CoursePreferences, type SettingsMode, type BoardTheme, type PieceSet } from '#lib/settings/types.ts';
 import { setMuted } from '#lib/sound.ts';
 let { mode, courseId, sharedStartAvailable = false, onchange }: { mode: SettingsMode; courseId: string; sharedStartAvailable?: boolean; onchange?: (preferences: Preferences, course: CoursePreferences) => void } = $props();
 let preferences = $state<Preferences>({ ...DEFAULT_PREFERENCES });
 let course = $state<CoursePreferences>({ ...DEFAULT_COURSE_PREFERENCES });
 let ready = $state(false);
 onMount(async () => { [preferences, course] = await Promise.all([readPreferences(), readCoursePreferences(courseId)]); ready = true; onchange?.(preferences, course); });
 let pending = Promise.resolve();
 function save() {
  const next = $state.snapshot(preferences), nextCourse = $state.snapshot(course), id = courseId;
  onchange?.(next, nextCourse);
  pending = pending.catch(() => {}).then(async () => { await writePreferences(next); await writeCoursePreferences(id, nextCourse); await setMuted(!next.sound); });
 }
 const pieceSets: PieceSet[] = ['default', 'geometric', 'outline'];
 const themes: BoardTheme[] = ['default', 'green', 'brown', 'blue', 'dark-blue'];
</script>
<div class="settings" aria-label="Trainer settings">
 {#if mode === 'learn'}<label>Coaching <select bind:value={preferences.coaching} onchange={save}><option value="default">Automatic</option><option value="always">Every move</option><option value="tap">On request</option></select></label>{/if}
 {#if mode === 'learn' || mode === 'practice'}<label>Move arrows <select bind:value={preferences.arrows} onchange={save}><option value="none">None</option><option value="withDialog">With coaching</option><option value="always">Always</option></select></label>{/if}
 {#if mode !== 'puzzles'}<label><input type="checkbox" bind:checked={preferences.evalBar} onchange={save}> Evaluation bar</label>{/if}
 {#if mode === 'drill' || mode === 'time'}<label><input type="checkbox" bind:checked={course.fastOpponent} onchange={save}> Fast opponent</label>{/if}
 {#if sharedStartAvailable && (mode === 'learn' || mode === 'practice' || mode === 'drill')}<label><input type="checkbox" bind:checked={course.skipSharedStart} onchange={save}> Skip shared start when available</label>{/if}
 {#if mode === 'puzzles'}<label><input type="checkbox" bind:checked={preferences.autoNext} onchange={save}> Next puzzle automatically</label>{/if}
 <label><input type="checkbox" bind:checked={preferences.sound} onchange={save}> Sound</label>
 <label><input type="checkbox" bind:checked={preferences.confetti} onchange={save}> Confetti</label>
 <label><input type="checkbox" bind:checked={preferences.haptics} onchange={save}> Haptics</label>
 <label>Text size <select bind:value={preferences.textSize} onchange={save}><option value="default">Default</option><option value="large">Large</option><option value="xl">Extra large</option></select></label>
 <fieldset disabled={!ready}><legend>Board color</legend><div class="themes">{#each themes as theme}<button type="button" class:selected={preferences.theme === theme} aria-label={theme} aria-pressed={preferences.theme === theme} onclick={() => { preferences.theme = theme; void save(); }}><MiniBoard fen={START_FEN} size={60} {theme}/><span>{theme}</span></button>{/each}</div></fieldset>
 <fieldset disabled={!ready}><legend>Pieces</legend><div class="themes">{#each pieceSets as pieces}<button type="button" class:selected={preferences.pieces === pieces} aria-label={pieces} aria-pressed={preferences.pieces === pieces} onclick={() => { preferences.pieces = pieces; void save(); }}><MiniBoard fen={START_FEN} size={60} theme={preferences.theme} {pieces}/><span>{pieces === 'geometric' ? 'Geometric' : pieces === 'outline' ? 'Outline' : 'Default'}</span></button>{/each}</div></fieldset>
</div>
<style>
 .settings { display: grid; gap: 12px; } label { display: flex; align-items: center; gap: 8px; } select { margin-left: auto; background: var(--surface-2); color: var(--text); border: 1px solid var(--surface-4); border-radius: var(--r-sm); padding: 6px; } input { accent-color: var(--accent); } fieldset { border: 0; padding: 0; } legend { margin-bottom: 8px; } .themes { display: flex; flex-wrap: wrap; gap: 8px; } .themes button { display: grid; gap: 4px; justify-items: center; background: var(--surface-2); color: inherit; border: 1px solid transparent; border-radius: var(--r-sm); padding: 4px; font-size: 11px; } .themes button.selected { border-color: var(--accent); }
</style>
