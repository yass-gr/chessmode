<script lang="ts">
	import { seg } from '#lib/components/seg.ts';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { finishLearn } from '#lib/srs.ts';
	import { parseCourse } from '#lib/courses/parse.ts';
	import { db } from '#lib/db.ts';
	import type { CourseFile } from '#lib/courses/types.ts';
	import type { Color } from '#lib/chess/types.ts';
	import { copyCourse, newCustomId, saveCustomCourse, preserveLineIds } from '#lib/courses/custom.ts';
	import CoveragePanel from '#lib/components/courses/CoveragePanel.svelte';
	import { courseCoverage } from '#lib/explorer/coverage.ts';
	import { loadExplorer, type Explorer } from '#lib/explorer/types.ts';
	import { courses } from '#lib/courses/index.ts';
	import { buildPgnCourse, exportCoursePgn, type BuiltCourse } from '#lib/courses/pgn-tree.ts';

	let source = $state<'pgn' | 'study'>('study');
	let pgn = $state('');
	let url = $state('');
	let name = $state('');
	let side = $state<Color>('w');
	let fetching = $state(false);
	let fetchError = $state('');
	let saving = $state(false);
	let id = $state(newCustomId());
	let previous = $state<CourseFile | undefined>();
	let explorer = $state<Explorer | undefined>();
	let coverageSource = $state('');
	let selectedGap = $state('');
	async function selectCoverage(value: string) {
		coverageSource = value;
		explorer = value ? await loadExplorer(value) : undefined;
	}
	const report = $derived.by(() => {
		if (!previous || !built || !('ok' in built)) return undefined;
		const next = preserveLineIds(previous, built.ok.file);
		const old = previous.chapters.flatMap((chapter) => chapter.lines);
		const fresh = next.chapters.flatMap((chapter) => chapter.lines);
		return { kept: fresh.filter((line) => old.some((item) => item.id === line.id)), added: fresh.filter((line) => !old.some((item) => item.id === line.id)), removed: old.filter((line) => !fresh.some((item) => item.id === line.id)) };
	});
	const coverage = $derived.by(() => {
		if (!explorer || !built || !('ok' in built)) return undefined;
		try { return courseCoverage(parseCourse(built.ok.file), explorer); } catch { return undefined; }
	});
	let loadError = $state('');
	onMount(async () => {
		const edit = new URLSearchParams(location.search).get('edit');
		if (!edit) return;
		const row = await db.customCourses.get(edit);
		if (!row) { loadError = 'Course not found on this device.'; return; }
		previous = row.file; id = row.id; name = row.file.name; side = row.file.side; pgn = exportCoursePgn(row.file); source = 'pgn';
	});
	async function readFile(file: File | undefined) { if (file) adopt(await file.text()); }
	function download() {
		if (!built || !('ok' in built)) return;
		const url = URL.createObjectURL(new Blob([exportCoursePgn(built.ok.file)], { type: 'application/x-chess-pgn' }));
		const link = document.createElement('a'); link.href = url; link.download = 'repertoire.pgn'; link.click(); URL.revokeObjectURL(url);
	}

	const built = $derived.by((): { ok: BuiltCourse; skipped: number } | { error: string } | undefined => {
		if (!pgn.trim()) return undefined;
		try {
			const result = buildPgnCourse(pgn, { id, name: name.trim() || 'My course', side });
			parseCourse(result.file);
			return { ok: result, skipped: result.skipped };
		} catch (error) {
			return { error: error instanceof Error ? error.message : String(error) };
		}
	});

	const studyId = $derived(url.match(/lichess\.org\/study\/([A-Za-z0-9]{8})/)?.[1]);

	/** Lichess exports name the study and the board orientation in each chapter's headers. */
	function adopt(text: string) {
		pgn = text;
		const study = text.match(/^\[StudyName "(.+)"\]$/m)?.[1];
		if (study && !name) name = study;
		const orientation = text.match(/^\[Orientation "(white|black)"\]$/m)?.[1];
		if (orientation) side = orientation === 'white' ? 'w' : 'b';
	}

	async function fetchStudy() {
		if (!studyId) return;
		fetching = true;
		fetchError = '';
		try {
			const res = await fetch(`https://lichess.org/api/study/${studyId}.pgn?comments=true&variations=true&clocks=false&orientation=true`);
			if (!res.ok) throw new Error(res.status === 404 ? 'Lichess has no public study at that link.' : `Lichess answered ${res.status}.`);
			adopt(await res.text());
		} catch (error) {
			fetchError = error instanceof Error && error.message.startsWith('Lichess') ? error.message : 'Could not reach Lichess. Check the link and your connection.';
		} finally {
			fetching = false;
		}
	}

	async function copy() {
		if (!previous) return;
		const file = copyCourse(previous);
		await saveCustomCourse(file);
		await goto(`/create?edit=${file.id}`, { invalidateAll: true });
		location.reload();
	}
	async function markLearned() {
		if (!previous || !confirm('Mark every saved line as learned?')) return;
		for (const line of parseCourse(previous).lines) await finishLearn(line.key, previous.id);
		loadError = 'All saved lines are marked learned.';
	}
	async function create() {
		if (!built || !('ok' in built)) return;
		saving = true;
		await saveCustomCourse(built.ok.file);
		await goto(`/course/${id}`);
	}
</script>

<svelte:head><title>Create a course · Chessmode</title></svelte:head>

<main class="page">
	<header class="top">
		<a class="icon-btn" href="/courses" aria-label="Back">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
		</a>
		<h1 class="h-title">{previous ? 'Edit course' : 'Create a course'}</h1>
	</header>

	{#if loadError}<p class="error">{loadError}</p>{/if}
	{#if previous}<p class="muted">Saving replaces this course. Unchanged move sequences keep their progress; changed or removed lines lose it.</p><div class="actions"><button class="btn btn-surface" onclick={copy}>Copy saved course</button><button class="btn btn-surface" onclick={markLearned}>Mark saved lines learned</button></div>{/if}
	<p class="muted lead">Turn your own repertoire into a course. Every branch becomes a line you learn, practice and drill like any other.</p>

	<div class="seg" use:seg role="group" aria-label="Source">
		<button aria-pressed={source === 'study'} onclick={() => (source = 'study')}>Lichess study</button>
		<button aria-pressed={source === 'pgn'} onclick={() => (source = 'pgn')}>Paste PGN</button>
	</div>

	{#if source === 'study'}
		<div class="study">
			<label class="field">
				<input type="url" placeholder="https://lichess.org/study/…" bind:value={url} aria-label="Lichess study link" autocapitalize="none" spellcheck={false} />
			</label>
			<button class="btn btn-surface" disabled={!studyId || fetching} onclick={fetchStudy}>{fetching ? 'Loading…' : 'Load'}</button>
		</div>
		{#if fetchError}<p class="error">{fetchError}</p>{:else if url && !studyId}<p class="hint muted">Paste a public study link, for example lichess.org/study/abcd1234.</p>{/if}
		{#if pgn && source === 'study'}<p class="hint muted">Loaded {pgn.match(/^\[Event /gm)?.length ?? 1} chapters.</p>{/if}
	{:else}
		<label class="field area" ondragover={(event) => event.preventDefault()} ondrop={(event) => { event.preventDefault(); void readFile(event.dataTransfer?.files[0]); }}>
			<textarea rows="8" placeholder={'1. e4 c6 2. d4 d5 (2... g6) 3. e5 Bf5 *'} bind:value={pgn} aria-label="PGN" spellcheck={false}></textarea>
		</label>
		<label>Choose a PGN file <input type="file" accept=".pgn,text/plain" onchange={(event) => readFile(event.currentTarget.files?.[0])} /></label>
		<p class="hint muted">Paste or drop PGN. Edit chapter headers, moves, notes and [%cal] / [%csl] board annotations directly here. Variations become separate lines.</p>
	{/if}

	<label class="field">
		<input type="text" placeholder="Course name" bind:value={name} aria-label="Course name" maxlength="60" />
	</label>

	<div class="seg" use:seg role="group" aria-label="You play">
		<button aria-pressed={side === 'w'} onclick={() => (side = 'w')}>I play White</button>
		<button aria-pressed={side === 'b'} onclick={() => (side = 'b')}>I play Black</button>
	</div>

	{#if built && 'error' in built}
		<p class="error">{built.error}</p>
	{:else if built}
		{@const lines = built.ok.file.chapters.flatMap((chapter) => chapter.lines)}
		<section class="card result">
			<p><b>{lines.length} {lines.length === 1 ? 'line' : 'lines'}</b> for {side === 'w' ? 'White' : 'Black'}.</p>
			<ol class="mono">
				{#each lines.slice(0, 5) as line (line.id)}<li>{line.name}</li>{/each}
				{#if lines.length > 5}<li class="muted">and {lines.length - 5} more</li>{/if}
			</ol>
			{#if built.skipped}
				<p class="warn">Skipped {built.skipped} {built.skipped === 1 ? 'chapter that starts' : 'chapters that start'} from a set-up position or another variant.</p>
			{/if}
			{#if built.ok.conflicts.length}
				<p class="warn">Your PGN gives two moves for you in {built.ok.conflicts.length === 1 ? 'one position' : `${built.ok.conflicts.length} positions`}. A course needs one answer, so the first is kept.</p>
				<ul class="mono conflicts">
					{#each built.ok.conflicts.slice(0, 4) as c (c)}<li>{c}</li>{/each}
				</ul>
			{/if}
		{#each built.ok.file.chapters as chapter}
				<p><b>{chapter.name}</b> · {chapter.lines.length} lines</p>
			{/each}
			{#if report}
				<p><b>Reimport changes</b> · {report.kept.length} progress mappings kept · {report.added.length} added · {report.removed.length} removed or changed</p>
				{#if report.added.length}<p>Added: {report.added.map((line) => line.name).join(', ')}</p>{/if}
				{#if report.removed.length}<p>Removed or changed: {report.removed.map((line) => line.name).join(', ')}</p>{/if}
			{/if}
		<button class="btn btn-surface" onclick={download}>Export preview as PGN</button>
		</section>
	{/if}
	{#if built && 'ok' in built}
		<label>Compare coverage with a local opening sample
			<select value={coverageSource} onchange={(event) => selectCoverage(event.currentTarget.value)}>
				<option value="">Choose a sample</option>
				{#each courses.filter((course) => !course.id.startsWith('custom-')) as course}<option value={course.id}>{course.name}</option>{/each}
			</select>
		</label>
		{#if coverage && explorer}<CoveragePanel {coverage} {explorer} onselect={(gap) => { selectedGap = `${gap.path.join(' ')} → ${gap.san}`; }} />{/if}
		{#if selectedGap}<p>Position to inspect in PGN: {selectedGap}</p>{/if}
	{/if}
</main>

<div class="cta">
	<button class="btn btn-primary block" disabled={!built || !('ok' in built) || saving} onclick={create}>{previous ? 'Save changes' : 'Create course'}</button>
</div>

<style>
	.top {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 0 10px;
	}
	.lead {
		margin: 0 0 18px;
		line-height: 1.5;
	}
	.page {
		display: grid;
		gap: 12px;
		align-content: start;
		padding-bottom: 140px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.study {
		display: flex;
		gap: 8px;
	}
	.study .field {
		flex: 1;
		min-width: 0;
	}
	.area {
		height: auto;
		padding: 12px 16px;
	}
	.area textarea {
		resize: vertical;
		font: 16px/1.5 var(--mono);
	}
	.hint,
	.error,
	.warn {
		margin: -4px 2px 0;
		font-size: 13px;
		line-height: 1.45;
	}
	.error {
		color: var(--bad);
	}
	.warn {
		color: var(--text-2);
		margin-top: 6px;
	}
	.result {
		padding: 14px 16px;
		display: grid;
		gap: 8px;
	}
	.result ol,
	.result ul {
		margin: 0;
		padding-left: 18px;
		font-size: 12px;
		color: var(--text-2);
		display: grid;
		gap: 3px;
	}
	.conflicts {
		color: var(--text-3);
	}
	.cta {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		bottom: calc(var(--tabbar-h) + 26px + var(--safe-bottom));
		width: min(calc(100% - 36px), 520px);
		z-index: 30;
	}
</style>
