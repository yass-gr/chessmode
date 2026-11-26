<script lang="ts">
	import { ArrowRightLeft, ChevronLeft } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { Chess } from 'chess.js';
	import { liveQuery } from 'dexie';
	import Board from '#lib/components/Board.svelte';
	import { seg } from '#lib/components/seg.ts';
	import { START_FEN, type Color, type Fen, type Uci } from '#lib/chess/types.ts';
	import { newCustomId, saveCustomCourse } from '#lib/courses/custom.ts';
	import { db } from '#lib/db.ts';
	import { getEngine } from '#lib/engine/stockfish.ts';
	import { fetchChesscomGame } from '#lib/import/public-game.ts';
	import { readPgn } from '#lib/import/pgn.ts';
	import { explorerHref } from '#lib/explorer/browse.ts';
	import { addGameToCourse, analysisRecord, courseFromGame } from '#lib/review/handoff.ts';
	import type { EngineLine, Score } from '#lib/review/types.ts';
	import {
		boardFromGamePgn,
		currentFen,
		emptyBoard,
		enterVariation,
		goTo,
		otherMoves,
		play,
		toPgn,
		type AnalysisBoard
	} from '#lib/review/variations.ts';

	let board = $state<AnalysisBoard>(emptyBoard());
	let orientation = $state<'white' | 'black'>('white');
	let error = $state('');
	let notice = $state('');
	let pgnText = $state('');
	let chesscom = $state('');
	let busy = $state(false);
	let savedHref = $state('');
	let courseName = $state('From a game');
	let side = $state<Color>('w');
	let target = $state('');
	let custom = $state<{ id: string; name: string; side: Color }[]>([]);
	let lines = $state<EngineLine[]>([]);
	let engineFen = $state('');
	let engineNote = $state('');
	let engineBusy = $state(false);
	let engineAbort: AbortController | undefined;

	const fen = $derived(currentFen(board));
	const last = $derived(board.cursor > 0 ? board.line[board.cursor - 1] : undefined);
	const others = $derived(otherMoves(board));
	const sameSide = $derived(custom.filter((course) => course.side === side));
	const positionHref = $derived(fen === START_FEN ? '/analysis' : `/analysis?fen=${encodeURIComponent(fen)}`);
	const shownLines = $derived(engineFen === fen ? lines : []);

	$effect(() => {
		if (target && !custom.some((course) => course.id === target && course.side === side)) target = '';
	});

	onMount(() => {
		const params = page.url.searchParams;
		const gameId = params.get('game');
		if (params.get('add') === 'course') {
			queueMicrotask(() => document.getElementById('add-course')?.scrollIntoView({ block: 'nearest' }));
		}
		const fenParam = params.get('fen');
		const subscription = liveQuery(() => db.customCourses.toArray()).subscribe({
			next: (rows) => {
				custom = rows.map((row) => ({ id: row.id, name: row.file.name, side: row.file.side }));
			}
		});
		void (async () => {
			if (!gameId) {
				if (!fenParam) return;
				try {
					board = emptyBoard(fenParam as Fen);
				} catch {
					error = 'That position could not be read.';
				}
				return;
			}
			const game = await db.games.get(gameId);
			if (!game) {
				error = 'This game is missing from your saved matches.';
				return;
			}
			try {
				board = boardFromGamePgn(game.pgn);
			} catch (cause) {
				error = cause instanceof Error ? cause.message : 'This game could not be opened.';
				return;
			}
			if (game.userColor === 'b') orientation = 'black';
			courseName = game.opening?.name || 'From a game';
			side = game.userColor ?? side;
		})();
		return () => {
			subscription.unsubscribe();
			engineAbort?.abort();
		};
	});

	function onmove(uci: string) {
		error = '';
		try {
			board = play(board, uci as Uci);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'That move is not legal here.';
		}
	}

	function formatScore(score: Score) {
		if (score.mate !== undefined) return `M${score.mate}`;
		const pawns = score.cp / 100;
		return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
	}

	function lineText(line: EngineLine) {
		const chess = new Chess(fen);
		const sans: string[] = [];
		for (const move of line.pv) {
			try {
				const played = chess.move({
					from: move.slice(0, 2),
					to: move.slice(2, 4),
					promotion: move[4] as 'q' | 'r' | 'b' | 'n' | undefined
				});
				sans.push(played.san);
			} catch {
				break;
			}
		}
		return sans.join(' ');
	}

	async function runEngine() {
		engineAbort?.abort();
		const request = new AbortController();
		engineAbort = request;
		const at = fen;
		engineFen = at;
		engineBusy = true;
		engineNote = '';
		lines = [];
		try {
			const result = await getEngine().analyse(at, { depth: 12, multiPv: 3, signal: request.signal }, (update) => {
				if (currentFen(board) === at) lines = update.lines;
			});
			if (currentFen(board) === at) lines = result.lines;
			if (!result.lines.length) engineNote = 'No engine line. The position may already be finished.';
		} catch (cause) {
			if (!request.signal.aborted) engineNote = cause instanceof Error ? cause.message : 'The engine stopped.';
		} finally {
			if (engineAbort === request) engineBusy = false;
		}
	}

	function playEngine(uci: Uci | undefined) {
		if (!uci) return;
		onmove(uci);
	}

	function loadPgn(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		notice = '';
		try {
			board = boardFromGamePgn(pgnText);
			notice = 'PGN loaded. Your variations stay on the board until you replace the game.';
			savedHref = '';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'This PGN could not be read. Paste one complete game with legal moves.';
		}
	}

	async function loadChesscom(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		const request = new AbortController();
		busy = true;
		error = '';
		notice = '';
		try {
			const game = await fetchChesscomGame(chesscom, request.signal);
			await db.games.put(game);
			board = boardFromGamePgn(game.pgn);
			savedHref = `/review/${game.id}`;
			notice = 'Chess.com game saved on this device.';
			courseName = game.opening?.name || 'From a game';
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'That Chess.com game could not be imported.';
		} finally {
			busy = false;
		}
	}

	async function saveGame() {
		error = '';
		try {
			readPgn(toPgn(board));
			const record = analysisRecord(board);
			await db.games.put(record);
			savedHref = `/review/${record.id}`;
			notice = 'Game saved on this device.';
			return record;
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'This board could not be saved. Play a move first.';
			savedHref = '';
		}
	}

	async function openReview() {
		const record = await saveGame();
		if (record) await goto(`/review/${record.id}`);
	}

	async function copyPosition() {
		const url = new URL(positionHref, window.location.origin).toString();
		try {
			await navigator.clipboard.writeText(url);
			notice = 'Position link copied.';
		} catch {
			notice = url;
		}
	}

	async function addToCourse(event: SubmitEvent) {
		event.preventDefault();
		error = '';
		let pgn: string;
		try {
			pgn = toPgn(board);
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'Play a move before adding a course.';
			return;
		}
		try {
			if (target) {
				const row = await db.customCourses.get(target);
				if (!row) {
					error = 'That course is no longer on this device.';
					return;
				}
				const built = addGameToCourse(row.file, pgn);
				await saveCustomCourse(built.file);
				notice = built.conflicts.length
					? `Added to ${built.file.name}. ${built.conflicts.length} positions kept the first move for your side.`
					: `Added to ${built.file.name}.`;
			} else {
				const built = courseFromGame({ id: newCustomId(), name: courseName.trim() || 'From a game', side, pgn });
				await saveCustomCourse(built.file);
				target = built.file.id;
				notice = `Saved “${built.file.name}” on this device.`;
			}
		} catch (cause) {
			error = cause instanceof Error ? cause.message : 'The game could not be added to a course.';
		}
	}
</script>

<svelte:head><title>Analysis · Chessmode</title></svelte:head>

<main class="page analysis">
	<header class="top">
		<a class="icon-btn" href="/matches" aria-label="Back to Matches">
			<ChevronLeft size={18} stroke-width={1.75} />
		</a>
		<div class="titles">
			<h1>Analysis</h1>
			<p>Play either side. Variations stay yours.</p>
		</div>
		<button type="button" class="icon-btn" aria-label="Flip board" onclick={() => (orientation = orientation === 'white' ? 'black' : 'white')}>
			<ArrowRightLeft size={18} stroke-width={1.75} />
		</button>
	</header>

	<div class="workspace">
		<section class="board-column" aria-label="Analysis board">
			<Board {fen} orientation={orientation} movable="both" lastMove={last ? [last.uci.slice(0, 2), last.uci.slice(2, 4)] : undefined} {onmove} />
			<div class="nav">
				<button class="btn sm btn-surface" type="button" disabled={board.cursor === 0} onclick={() => (board = goTo(board, board.cursor - 1))}>Back</button>
				<button class="btn sm btn-surface" type="button" disabled={board.cursor >= board.line.length} onclick={() => (board = goTo(board, board.cursor + 1))}>Forward</button>
				<button class="btn sm btn-primary" type="button" disabled={engineBusy} onclick={runEngine}>{engineBusy ? 'Running…' : 'Run engine'}</button>
			</div>
		</section>

		<section class="panel">
			<div class="card moves" aria-label="Move history">
				{#if board.line.length}
					{#each board.line as edge, index (edge.uci + index)}
						<button class="move" class:on={index === board.cursor - 1} type="button" onclick={() => (board = goTo(board, index + 1))}>
							{#if index % 2 === 0}<span>{index / 2 + 1}.</span>{/if}
							{edge.san}
						</button>
					{/each}
				{:else}
					<p class="muted">Play a move, or import a game.</p>
				{/if}
			</div>
			{#if others.length}
				<div class="vars" aria-label="Variations">
					<span class="muted">Other moves here</span>
					{#each others as edge (edge.uci)}
						<button class="chip" type="button" onclick={() => (board = enterVariation(board, edge.uci))}>{edge.san}</button>
					{/each}
				</div>
			{/if}

			<section class="card engine" aria-label="Engine">
				<h2>Engine</h2>
				{#if engineNote}<p class="muted">{engineNote}</p>{/if}
				{#if shownLines.length}
					{#each shownLines as line, index (`${line.pv[0]}-${index}`)}
						<div class="engine-line">
							<b>{formatScore(line.score)}</b>
							<span>{lineText(line)}</span>
							<button class="btn sm btn-surface" type="button" onclick={() => playEngine(line.pv[0])}>Play</button>
						</div>
					{/each}
					<p class="muted">Playing a line adds a variation. The main line stays first.</p>
				{:else if !engineNote}
					<p class="muted">Run the engine for this position. It does not change your moves.</p>
				{/if}
			</section>

			<section class="card import" aria-label="Import">
				<h2>Import</h2>
				<form onsubmit={loadChesscom}>
					<label class="field">
						<input aria-label="Chess.com game link" placeholder="Chess.com game link" bind:value={chesscom} disabled={busy} />
					</label>
					<button class="btn sm btn-surface block" type="submit" disabled={busy}>{busy ? 'Importing…' : 'Import Chess.com game'}</button>
				</form>
				<form onsubmit={loadPgn}>
					<textarea aria-label="Game PGN" placeholder="1. e4 e5 2. Nf3…" bind:value={pgnText} rows="4" spellcheck={false}></textarea>
					<button class="btn sm btn-surface block" type="submit">Load PGN</button>
				</form>
			</section>

			<section class="card actions" aria-label="Position actions">
				<button class="btn sm btn-surface block" type="button" onclick={copyPosition}>Copy position link</button>
				<button class="btn sm btn-surface block" type="button" onclick={saveGame}>Save game</button>
				<a class="btn sm btn-surface block" href={explorerHref({ fen })}>Explorer</a>
				<button class="btn btn-primary block" type="button" onclick={openReview}>Open full review</button>
			</section>
			{#if savedHref}<p class="muted">Saved game · <a class="link" href={savedHref}>Open review</a></p>{/if}
			{#if notice}<p class="feedback" role="status">{notice}</p>{/if}
			{#if error}<p class="feedback bad" role="alert">{error}</p>{/if}

			<section class="card handoff" id="add-course" aria-label="Add to a course">
				<h2>Add to a course</h2>
				<p class="muted">Save this game as a line on this device.</p>
				<form onsubmit={addToCourse}>
					<div class="seg" use:seg role="group" aria-label="Your side">
						<button type="button" aria-pressed={side === 'w'} onclick={() => (side = 'w')}>White</button>
						<button type="button" aria-pressed={side === 'b'} onclick={() => (side = 'b')}>Black</button>
					</div>
					{#if sameSide.length}
						<div class="courses" role="group" aria-label="Course">
							<button class="chip" class:accent={target === ''} type="button" aria-pressed={target === ''} onclick={() => (target = '')}>New course</button>
							{#each sameSide as course (course.id)}
								<button class="chip" class:accent={target === course.id} type="button" aria-pressed={target === course.id} onclick={() => (target = course.id)}>{course.name}</button>
							{/each}
						</div>
					{/if}
					{#if !target}
						<label class="field">
							<input aria-label="Course name" placeholder="Course name" bind:value={courseName} />
						</label>
					{/if}
					<button class="btn btn-primary block" type="submit">{target ? 'Add to this course' : 'Create course'}</button>
				</form>
			</section>
		</section>
	</div>
</main>

<style>
	.analysis {
		max-width: 1080px;
		padding-bottom: calc(28px + var(--safe-bottom));
	}
	.top {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 0 16px;
	}
	.titles {
		flex: 1;
		min-width: 0;
	}
	h1 {
		font-size: 22px;
		letter-spacing: -0.03em;
		line-height: 1.15;
	}
	.top p,
	.muted,
	.feedback {
		color: var(--text-2);
		font-size: 13px;
	}
	.top p {
		line-height: 1.35;
	}
	.workspace {
		display: grid;
		gap: 18px;
	}
	.board-column,
	.panel,
	form,
	.import,
	.engine,
	.handoff,
	.actions {
		display: grid;
		gap: 12px;
		align-content: start;
	}
	.panel .card {
		padding: 16px;
	}
	.panel .card > * {
		position: relative;
		z-index: 1;
	}
	.nav {
		display: grid;
		grid-template-columns: 1fr 1fr 1.35fr;
		gap: 8px;
	}
	.nav .btn {
		width: 100%;
		padding-inline: 10px;
	}
	.courses,
	.vars {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.moves {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		min-height: 52px;
	}
	.move {
		min-height: 36px;
		padding: 6px 8px;
		border-radius: var(--r-sm);
		font-weight: 600;
	}
	.move span {
		margin-right: 4px;
		color: var(--text-3);
		font: 12px var(--mono);
	}
	.move.on {
		background: var(--accent-soft);
		color: var(--accent-hi);
	}
	.engine-line {
		display: grid;
		grid-template-columns: 4.2rem minmax(0, 1fr) auto;
		gap: 8px;
		align-items: center;
	}
	.engine-line b {
		font: 13px var(--mono);
		color: var(--accent-hi);
	}
	.engine-line span {
		overflow: hidden;
		color: var(--text);
		font-size: 14px;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	h2 {
		font-size: 16px;
	}
	textarea {
		width: 100%;
		padding: 10px;
		border: 1px solid var(--stroke-2);
		border-radius: var(--r-sm);
		resize: vertical;
		background: var(--bg);
		color: var(--text);
		font: 13px/1.5 var(--mono);
	}
	.chip {
		cursor: pointer;
	}
	.link {
		color: var(--accent-hi);
		font-weight: 650;
	}
	.bad {
		color: var(--bad);
	}
	@media (min-width: 900px) {
		.workspace {
			grid-template-columns: minmax(280px, 480px) minmax(0, 1fr);
			gap: 28px;
			align-items: start;
		}
	}
</style>
