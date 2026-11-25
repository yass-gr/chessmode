<script lang="ts">
	import { seg } from '#lib/components/seg.ts';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { finishLearn } from '#lib/srs.ts';
	import { parseCourse } from '#lib/courses/parse.ts';
	import { db } from '#lib/db.ts';
	import type { CourseFile } from '#lib/courses/types.ts';
	import type { Color } from '#lib/chess/types.ts';
	import { copyCourse, diffReimport, newCustomId, saveCustomCourse, type ReimportLine } from '#lib/courses/custom.ts';
	import CoveragePanel from '#lib/components/courses/CoveragePanel.svelte';
	import CourseEditor from './CourseEditor.svelte';
	import { courseCoverage, type Gap } from '#lib/explorer/coverage.ts';
	import { loadExplorer, type Explorer } from '#lib/explorer/types.ts';
	import { courses } from '#lib/courses/index.ts';
	import { buildPgnCourse, exportCoursePgn } from '#lib/courses/pgn-tree.ts';

	let source = $state<'pgn' | 'study'>('study');
	let pgn = $state('');
	let pgnEcho = $state('');
	let url = $state('');
	let name = $state('');
	let side = $state<Color>('w');
	let fetching = $state(false);
	let fetchError = $state('');
	let saving = $state(false);
	let id = $state(newCustomId());
	let previous = $state<CourseFile | undefined>();
	let draft = $state<CourseFile | undefined>();
	let generation = $state(0);
	let skipped = $state(0);
	let conflicts = $state<string[]>([]);
	let parseError = $state('');
	let progressKeys = $state<string[]>([]);
	let explorer = $state<Explorer | undefined>();
	let coverageSource = $state('');
	let focusFen = $state('');
	let focusToken = $state(0);
	let loadError = $state('');

	const titled = $derived({ id, name: name.trim() || 'My course', side });
	const lineCount = $derived(draft?.chapters.reduce((total, chapter) => total + chapter.lines.length, 0) ?? 0);
	const ready = $derived(draft ? { ...draft, ...titled } : undefined);
	const structureError = $derived.by(() => {
		if (!ready || !lineCount) return '';
		try {
			parseCourse(ready);
			return '';
		} catch (error) {
			return error instanceof Error ? error.message : String(error);
		}
	});
	const report = $derived.by(() => {
		if (!previous || !ready || structureError || parseError) return undefined;
		try {
			return diffReimport(previous, ready, progressKeys);
		} catch {
			return undefined;
		}
	});
	const coverage = $derived.by(() => {
		if (!explorer || !ready || structureError) return undefined;
		try {
			return courseCoverage(parseCourse(ready), explorer);
		} catch {
			return undefined;
		}
	});

	function listed(lines: ReimportLine[]) {
		const shown = lines.slice(0, 8).map((line) => line.name);
		return lines.length > 8 ? `${shown.join(', ')} and ${lines.length - 8} more` : shown.join(', ');
	}

	function ingest(text: string) {
		pgn = text;
		if (!text.trim()) {
			parseError = 'The PGN has no moves.';
			return;
		}
		try {
			const result = buildPgnCourse(text, titled);
			parseCourse(result.file);
			draft = { ...result.file, ...titled };
			skipped = result.skipped;
			conflicts = result.conflicts;
			parseError = '';
			pgnEcho = text;
			generation += 1;
		} catch (error) {
			parseError = error instanceof Error ? error.message : String(error);
		}
	}

	function onDraft(file: CourseFile) {
		draft = { ...file, ...titled };
		parseError = '';
		conflicts = [];
		const exported = exportCoursePgn(draft);
		pgn = exported;
		pgnEcho = exported;
	}

	async function loadProgress(courseId: string) {
		progressKeys = (await db.progress.where('courseId').equals(courseId).toArray()).map((row) => row.key);
	}

	onMount(async () => {
		const edit = new URLSearchParams(location.search).get('edit');
		if (!edit) return;
		const row = await db.customCourses.get(edit);
		if (!row) {
			loadError = 'Course not found on this device.';
			return;
		}
		previous = row.file;
		id = row.id;
		name = row.file.name;
		side = row.file.side;
		source = 'pgn';
		draft = row.file;
		pgn = exportCoursePgn(row.file);
		pgnEcho = pgn;
		generation += 1;
		await loadProgress(row.id);
	});

	async function readFile(file: File | undefined) {
		if (file) ingest(await file.text());
	}

	function download() {
		if (!ready) return;
		const linkUrl = URL.createObjectURL(new Blob([exportCoursePgn(ready)], { type: 'application/x-chess-pgn' }));
		const link = document.createElement('a');
		link.href = linkUrl;
		link.download = 'repertoire.pgn';
		link.click();
		URL.revokeObjectURL(linkUrl);
	}

	const studyId = $derived(url.match(/lichess\.org\/study\/([A-Za-z0-9]{8})/)?.[1]);

	/** Lichess exports name the study and the board orientation in each chapter's headers. */
	function adopt(text: string) {
		const study = text.match(/^\[StudyName "(.+)"\]$/m)?.[1];
		if (study && !name) name = study;
		const orientation = text.match(/^\[Orientation "(white|black)"\]$/m)?.[1];
		if (orientation) side = orientation === 'white' ? 'w' : 'b';
		ingest(text);
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

	async function selectCoverage(value: string) {
		coverageSource = value;
		explorer = value ? await loadExplorer(value) : undefined;
	}

	function openGap(gap: Gap) {
		focusFen = gap.fen;
		focusToken += 1;
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
		await loadProgress(previous.id);
		loadError = 'All saved lines are marked learned.';
	}

	async function create() {
		if (!ready || structureError || parseError || !lineCount) return;
		saving = true;
		const file = { ...ready, tagline: `${lineCount} ${lineCount === 1 ? 'line' : 'lines'} imported from PGN.` };
		await saveCustomCourse(file);
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
	{#if previous}
		<p class="muted">Saving replaces this course. Unchanged move sequences keep their progress. Changed and removed lines lose it.</p>
		<div class="actions">
			<button class="btn btn-surface" onclick={copy}>Copy saved course</button>
			<button class="btn btn-surface" onclick={markLearned}>Mark saved lines learned</button>
		</div>
	{/if}
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
			<textarea rows="8" placeholder={'1. e4 c6 2. d4 d5 (2... g6) 3. e5 Bf5 *'} bind:value={pgn} aria-label="PGN" spellcheck={false} oninput={() => { if (pgn !== pgnEcho) ingest(pgn); }}></textarea>
		</label>
		<label>Choose a PGN file <input type="file" accept=".pgn,text/plain" onchange={(event) => readFile(event.currentTarget.files?.[0])} /></label>
		<p class="hint muted">Paste or drop PGN. Variations become separate lines. Edit chapters, moves, notes and arrows on the board below.</p>
	{/if}

	<label class="field">
		<input type="text" placeholder="Course name" bind:value={name} aria-label="Course name" maxlength="60" />
	</label>

	<div class="seg" use:seg role="group" aria-label="You play">
		<button aria-pressed={side === 'w'} onclick={() => (side = 'w')}>I play White</button>
		<button aria-pressed={side === 'b'} onclick={() => (side = 'b')}>I play Black</button>
	</div>

	{#if parseError}<p class="error">{parseError}</p>{/if}
	{#if structureError}<p class="error">{structureError}</p>{/if}

	{#if ready && lineCount}
		<section class="card result">
			<p><b>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</b> for {side === 'w' ? 'White' : 'Black'}.</p>
			{#if skipped}
				<p class="warn">Skipped {skipped} {skipped === 1 ? 'chapter that starts' : 'chapters that start'} from a set-up position or another variant.</p>
			{/if}
			{#if conflicts.length}
				<p class="warn">Your PGN gives two moves for you in {conflicts.length === 1 ? 'one position' : `${conflicts.length} positions`}. A course needs one answer, so the first is kept.</p>
				<ul class="mono conflicts">
					{#each conflicts.slice(0, 4) as conflict (conflict)}<li>{conflict}</li>{/each}
				</ul>
			{/if}
			{#each ready.chapters as chapter}
				<p><b>{chapter.name}</b> · {chapter.lines.length} lines</p>
			{/each}
			<button class="btn btn-surface" onclick={download}>Export preview as PGN</button>
		</section>
	{/if}

	{#if report}
		<section class="card result">
			<h2>Reimport</h2>
			{#if report.progressTotal === 0}
				<p>No learned lines yet, so there is no progress to keep.</p>
			{:else}
				<p><b>{report.progressKept} of {report.progressTotal}</b> learned {report.progressTotal === 1 ? 'line keeps its progress' : 'lines keep their progress'}.</p>
			{/if}
			<p>Added {report.added.length}{report.added.length ? `: ${listed(report.added)}` : ''}</p>
			<p>Changed {report.changed.length}{report.changed.length ? `: ${report.changed.slice(0, 8).map((line) => `${line.previousName} → ${line.name}`).join(', ')}` : ''}</p>
			<p>Removed {report.removed.length}{report.removed.length ? `: ${listed(report.removed)}` : ''}</p>
		</section>
	{/if}

	{#if ready}
		<CourseEditor file={ready} {side} {generation} {focusFen} {focusToken} onchange={onDraft} />
	{/if}

	{#if ready && lineCount}
		<label class="field choice">Compare coverage with a local opening sample
			<select value={coverageSource} onchange={(event) => selectCoverage(event.currentTarget.value)}>
				<option value="">Choose a sample</option>
				{#each courses.filter((course) => !course.id.startsWith('custom-')) as course}<option value={course.id}>{course.name}</option>{/each}
			</select>
		</label>
		{#if coverage && explorer}<CoveragePanel {coverage} {explorer} onselect={openGap} />{/if}
	{/if}
</main>

<div class="cta">
	<button class="btn btn-primary block" disabled={!ready || !!structureError || !!parseError || !lineCount || saving} onclick={create}>{previous ? 'Save changes' : 'Create course'}</button>
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
	.result h2 {
		font-size: 16px;
	}
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
	.choice {
		height: auto;
		padding: 10px 16px;
		display: grid;
		gap: 6px;
	}
	.choice select {
		width: 100%;
		height: 36px;
		color: var(--text);
		background: transparent;
		border: 0;
		font: inherit;
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
