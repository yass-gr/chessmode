<script lang="ts">
	import { seg } from '#lib/components/seg.ts';
	import { goto } from '$app/navigation';
	import type { Color } from '#lib/chess/types.ts';
	import { newCustomId, saveCustomCourse } from '#lib/courses/custom.ts';
	import { buildCourse, readPgnTree, type BuiltCourse } from '#lib/courses/pgn-tree.ts';

	let source = $state<'pgn' | 'study'>('study');
	let pgn = $state('');
	let url = $state('');
	let name = $state('');
	let side = $state<Color>('w');
	let fetching = $state(false);
	let fetchError = $state('');
	let saving = $state(false);
	const id = newCustomId();

	const built = $derived.by((): { ok: BuiltCourse; skipped: number } | { error: string } | undefined => {
		if (!pgn.trim()) return undefined;
		try {
			const { tree, skipped } = readPgnTree(pgn);
			return { ok: buildCourse(tree, { id, name: name.trim() || 'My course', side }), skipped };
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
		<h1 class="h-title">Create a course</h1>
	</header>

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
		<label class="field area">
			<textarea rows="8" placeholder={'1. e4 c6 2. d4 d5 (2... g6) 3. e5 Bf5 *'} bind:value={pgn} aria-label="PGN" spellcheck={false}></textarea>
		</label>
		<p class="hint muted">Variations become separate lines. Comments on your moves are kept as notes.</p>
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
		{@const lines = built.ok.file.chapters[0].lines}
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
		</section>
	{/if}
</main>

<div class="cta">
	<button class="btn btn-primary block" disabled={!built || !('ok' in built) || saving} onclick={create}>Create course</button>
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
