<script lang="ts">
	import Board, { type Arrow } from '#lib/components/Board.svelte';
	import { seg } from '#lib/components/seg.ts';
	import type { Color } from '#lib/chess/types.ts';
	import type { CourseFile } from '#lib/courses/types.ts';
	import {
		addChapter,
		deleteChapter,
		deleteLine,
		locateFen,
		moveLine,
		playMove,
		positionAt,
		readPlies,
		renameChapter,
		renameLine,
		setAnnotation,
		setIntro,
		truncateAt,
		type BoardMark,
		type EditorCursor,
		type MarkColor
	} from '#lib/courses/editor.ts';

	let {
		file,
		side,
		generation,
		focusFen = '',
		focusToken = 0,
		onchange
	}: {
		file: CourseFile;
		side: Color;
		generation: number;
		focusFen?: string;
		focusToken?: number;
		onchange: (file: CourseFile) => void;
	} = $props();

	const brushes = { G: 'good', R: 'bad', Y: 'accent', B: 'info' } as const;
	const swatches = [
		{ id: 'G' as const, label: 'Green', hex: '#3ecf8e' },
		{ id: 'R' as const, label: 'Red', hex: '#ff5a52' },
		{ id: 'Y' as const, label: 'Orange', hex: '#ff6b2c' },
		{ id: 'B' as const, label: 'Blue', hex: '#7cc4ff' }
	];

	let stored = $state<CourseFile | undefined>();
	const working = $derived(stored ?? file);
	let cursor = $state<EditorCursor>({ chapterId: '', lineId: '', ply: 0 });
	let mode = $state<'move' | 'arrow' | 'circle'>('move');
	let color = $state<MarkColor>('G');
	let arrowFrom = $state('');
	let error = $state('');
	let jumpMissed = $state(false);
	let noteDraft = $state('');
	let introDraft = $state('');
	let chapterName = $state('');
	let lineName = $state('');
	let boardEl = $state<HTMLDivElement | undefined>();
	let seenGeneration = -1;
	let seenFocus = 0;
	let noteKey = '';
	let introKey = '';
	let lineKey = '';
	let remember = '';

	const chapter = $derived(working.chapters.find((item) => item.id === cursor.chapterId) ?? working.chapters[0]);
	const line = $derived(chapter?.lines.find((item) => item.id === cursor.lineId) ?? chapter?.lines[0]);
	const plies = $derived(line ? readPlies(line.pgn) : []);
	const ply = $derived(Math.min(cursor.ply, plies.length));
	const spot = $derived(positionAt(line?.pgn ?? '', ply));
	const arrows = $derived.by((): Arrow[] => {
		const shapes = spot.marks.map((mark) => ({ from: mark.from, to: mark.to, brush: brushes[mark.color] }));
		if (arrowFrom) shapes.push({ from: arrowFrom, to: undefined, brush: brushes[color] });
		return shapes;
	});
	const active = $derived<EditorCursor>({ chapterId: chapter?.id ?? '', lineId: line?.id ?? '', ply });

	$effect(() => {
		const gen = generation;
		const next = file;
		const keep = remember || spot.fen;
		if (gen === seenGeneration) return;
		seenGeneration = gen;
		stored = next;
		cursor = locateFen(next, keep) ?? firstCursor(next);
		error = '';
		jumpMissed = false;
	});

	$effect(() => {
		const token = focusToken;
		const fen = focusFen;
		if (!token || token === seenFocus || !fen) return;
		seenFocus = token;
		const found = locateFen(working, fen);
		if (!found) {
			jumpMissed = true;
			return;
		}
		jumpMissed = false;
		cursor = found;
		remember = fen;
		boardEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	});

	$effect(() => {
		const key = `${line?.id ?? ''}:${ply}`;
		if (key === noteKey) return;
		noteKey = key;
		noteDraft = spot.note;
		arrowFrom = '';
	});

	$effect(() => {
		const key = chapter?.id ?? '';
		if (key === introKey) return;
		introKey = key;
		introDraft = chapter?.intro ?? '';
		chapterName = chapter?.name ?? '';
	});

	$effect(() => {
		const key = line?.id ?? '';
		if (key === lineKey) return;
		lineKey = key;
		lineName = line?.name ?? '';
	});

	function firstCursor(next: CourseFile): EditorCursor {
		const opening = next.chapters.find((item) => item.lines.length) ?? next.chapters[0];
		return { chapterId: opening?.id ?? '', lineId: opening?.lines[0]?.id ?? '', ply: 0 };
	}

	function commit(next: CourseFile, nextCursor: EditorCursor = active) {
		stored = next;
		cursor = nextCursor;
		const placed = next.chapters.find((item) => item.id === nextCursor.chapterId)?.lines.find((item) => item.id === nextCursor.lineId);
		remember = positionAt(placed?.pgn ?? '', nextCursor.ply).fen;
		onchange(next);
	}

	function onMove(uci: string) {
		const current = working.side === side ? working : { ...working, side };
		const result = playMove(current, active, uci);
		error = result.error ?? '';
		if (result.error) return;
		if (result.file !== current) commit(result.file, result.cursor);
		else cursor = result.cursor;
	}

	function squareAt(event: PointerEvent) {
		if (!boardEl) return;
		const rect = boardEl.getBoundingClientRect();
		const x = (event.clientX - rect.left) / rect.width;
		const y = (event.clientY - rect.top) / rect.height;
		if (x < 0 || y < 0 || x >= 1 || y >= 1) return;
		const white = side === 'w';
		const fileIndex = white ? Math.floor(x * 8) : 7 - Math.floor(x * 8);
		const rankIndex = white ? 7 - Math.floor(y * 8) : Math.floor(y * 8);
		return `${'abcdefgh'[fileIndex]}${rankIndex + 1}`;
	}

	function toggle(marks: BoardMark[], mark: BoardMark) {
		const index = marks.findIndex((item) => item.from === mark.from && item.to === mark.to);
		if (index < 0) return [...marks, mark];
		if (marks[index].color === mark.color) return marks.filter((_, at) => at !== index);
		return marks.map((item, at) => (at === index ? mark : item));
	}

	function draw(event: PointerEvent) {
		if (!line || ply < 1 || mode === 'move') return;
		const square = squareAt(event);
		if (!square) return;
		if (mode === 'circle') {
			commit(setAnnotation(working, active, noteDraft, toggle(spot.marks, { color, from: square })));
			return;
		}
		if (!arrowFrom || arrowFrom === square) {
			arrowFrom = arrowFrom === square ? '' : square;
			return;
		}
		commit(setAnnotation(working, active, noteDraft, toggle(spot.marks, { color, from: arrowFrom, to: square })));
		arrowFrom = '';
	}

	function go(next: number) {
		cursor = { ...active, ply: next };
		arrowFrom = '';
	}
</script>

<section class="editor card" aria-label="Board editor">
	<div class="fields">
		<label class="field">
			<span class="label">Chapter</span>
			<select aria-label="Chapter" value={chapter?.id ?? ''} onchange={(event) => {
				const id = event.currentTarget.value;
				const chosen = working.chapters.find((item) => item.id === id);
				cursor = { chapterId: id, lineId: chosen?.lines[0]?.id ?? '', ply: 0 };
			}}>
				{#each working.chapters as item (item.id)}<option value={item.id}>{item.name}</option>{/each}
			</select>
		</label>
		<label class="field">
			<input aria-label="Chapter name" bind:value={chapterName} onchange={() => chapter && commit(renameChapter(working, chapter.id, chapterName))} />
		</label>
		<div class="row">
			<button class="btn btn-surface" type="button" onclick={() => { const added = addChapter(working); commit(added.file, added.cursor); }}>Add chapter</button>
			<button class="btn btn-surface" type="button" disabled={!chapter || working.chapters.length < 2} onclick={() => {
				if (!chapter) return;
				const removed = deleteChapter(working, chapter.id);
				commit(removed.file, removed.cursor);
			}}>Delete chapter</button>
		</div>
		<label class="field">
			<span class="label">Chapter intro</span>
			<textarea rows="2" aria-label="Chapter intro" bind:value={introDraft} onchange={() => chapter && commit(setIntro(working, chapter.id, introDraft))}></textarea>
		</label>
		{#if chapter && chapter.lines.length}
			<label class="field">
				<span class="label">Line</span>
				<select aria-label="Line" value={line?.id ?? ''} onchange={(event) => { cursor = { chapterId: chapter.id, lineId: event.currentTarget.value, ply: 0 }; }}>
					{#each chapter.lines as item (item.id)}<option value={item.id}>{item.name}</option>{/each}
				</select>
			</label>
			<label class="field">
				<input aria-label="Line name" bind:value={lineName} onchange={() => line && commit(renameLine(working, active, lineName))} />
			</label>
			{#if working.chapters.length > 1}
				<label class="field">
					<span class="label">Move line to</span>
					<select aria-label="Move line to chapter" value={chapter.id} onchange={(event) => {
						const moved = moveLine(working, active, event.currentTarget.value);
						error = moved.error ?? '';
						if (!moved.error) commit(moved.file, moved.cursor);
					}}>
						{#each working.chapters as item (item.id)}<option value={item.id}>{item.name}</option>{/each}
					</select>
				</label>
			{/if}
			<div class="row">
				<button class="btn btn-surface" type="button" onclick={() => { const removed = deleteLine(working, active); commit(removed.file, removed.cursor); }}>Delete line</button>
				<button class="btn btn-surface" type="button" disabled={!line || ply >= plies.length} onclick={() => { const cut = truncateAt(working, active); commit(cut.file, cut.cursor); }}>Delete moves after here</button>
			</div>
		{:else}
			<p class="hint">This chapter has no lines yet. Play the first move on the board.</p>
		{/if}
	</div>

	<div class="board-col" id="repertoire-board" bind:this={boardEl}>
		<div class="plies" aria-label="Moves">
			<button type="button" class:on={ply === 0} onclick={() => go(0)}>Start</button>
			{#each plies as item, index (item.uci + index)}
				<button type="button" class:on={ply === index + 1} onclick={() => go(index + 1)}>{item.san}</button>
			{/each}
		</div>
		<div class="board">
			<Board fen={spot.fen} orientation={side === 'w' ? 'white' : 'black'} movable={mode === 'move' ? 'both' : 'none'} lastMove={spot.lastMove} {arrows} onmove={onMove} />
			{#if mode !== 'move'}
				<div class="draw" role="application" aria-label={mode === 'arrow' ? 'Draw an arrow' : 'Draw a circle'} onpointerdown={draw}></div>
			{/if}
		</div>
		<div class="seg" use:seg role="group" aria-label="Edit on the board">
			<button type="button" aria-pressed={mode === 'move'} onclick={() => (mode = 'move')}>Moves</button>
			<button type="button" aria-pressed={mode === 'arrow'} onclick={() => (mode = 'arrow')}>Arrow</button>
			<button type="button" aria-pressed={mode === 'circle'} onclick={() => (mode = 'circle')}>Circle</button>
		</div>
		<div class="colors" role="group" aria-label="Annotation color">
			{#each swatches as swatch (swatch.id)}
				<button type="button" class:on={color === swatch.id} style:background={swatch.hex} aria-label={swatch.label} aria-pressed={color === swatch.id} onclick={() => (color = swatch.id)}></button>
			{/each}
		</div>
		{#if ply < 1}<p class="hint">Play a move, then mark the position it reaches. Saved marks use [%cal] and [%csl].</p>{:else}<p class="hint">{arrowFrom ? `Arrow from ${arrowFrom}. Tap the destination square.` : 'Green, red, orange and blue match the board marks.'}</p>{/if}
		<label class="field">
			<span class="label">Note at this position</span>
			<textarea rows="2" aria-label="Note at this position" bind:value={noteDraft} disabled={ply < 1} onchange={() => line && ply > 0 && commit(setAnnotation(working, active, noteDraft, spot.marks))}></textarea>
		</label>
		{#if error}<p class="error">{error}</p>{/if}
		{#if jumpMissed}<p class="error">That position is not in the edited lines.</p>{/if}
	</div>
</section>

<style>
	.editor {
		display: grid;
		gap: 16px;
		padding: 14px;
	}
	.fields,
	.board-col {
		display: grid;
		gap: 10px;
		align-content: start;
	}
	.label {
		color: var(--text-2);
		font-size: 12px;
	}
	.field {
		height: auto;
		padding: 8px 12px;
		display: grid;
		gap: 4px;
	}
	select,
	textarea {
		width: 100%;
		color: var(--text);
		background: transparent;
		border: 0;
		font: inherit;
	}
	select {
		height: 36px;
	}
	textarea {
		resize: vertical;
		font: 15px/1.45 var(--font);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.row .btn {
		height: 44px;
		padding: 0 14px;
		font-size: 14px;
	}
	.plies {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.plies button {
		height: 36px;
		padding: 0 10px;
		border-radius: var(--r-pill);
		background: var(--surface-2);
		color: var(--text-2);
	}
	.plies button.on {
		background: var(--accent);
		color: #fff;
	}
	.board {
		position: relative;
	}
	.draw {
		position: absolute;
		inset: 0;
		z-index: 3;
		touch-action: none;
	}
	.colors {
		display: flex;
		gap: 8px;
	}
	.colors button {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
	}
	.colors button.on {
		box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--text);
	}
	.hint,
	.error {
		margin: 0;
		font-size: 13px;
		line-height: 1.45;
		color: var(--text-2);
	}
	.error {
		color: var(--bad);
	}
	@media (min-width: 900px) {
		.editor {
			grid-template-columns: minmax(240px, 360px) minmax(0, 1fr);
			align-items: start;
		}
		.board-col {
			position: sticky;
			top: 12px;
		}
	}
</style>
