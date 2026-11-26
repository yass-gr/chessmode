<script lang="ts">
	import { onMount } from 'svelte';
	import { Chess } from 'chess.js';
	import { page } from '$app/state';
	import Board from '#lib/components/Board.svelte';
	import PlayShell from '#lib/components/play/PlayShell.svelte';
	import ResultSheet from '#lib/components/train/ResultSheet.svelte';
	import { START_FEN, type Fen, type Ply, type San, type Uci } from '#lib/chess/types.ts';
	import { getCourse } from '#lib/courses/index.ts';
	import { db, type RatingRecord } from '#lib/db.ts';
	import { getEngine } from '#lib/engine/stockfish.ts';
	import { ARENA_START, ARENA_UNLOCK_LINES, arenaStep, sampleReply, sharedPrefix, startArena, updateRating, type ArenaState } from '#lib/explorer/arena.ts';
	import { loadExplorer, type Explorer } from '#lib/explorer/types.ts';
	import { getRating, recordResult } from '#lib/ratings.ts';
	import { logSession } from '#lib/progress.ts';
	import { findDeviation } from '#lib/review/repertoire.ts';
	import { scoreCp } from '#lib/review/classify.ts';
	import { play } from '#lib/sound.ts';

	const JUDGE_DEPTH = 14;
	const course = $derived(getCourse(page.params.course ?? ''));
	let explorer = $state.raw<Explorer>();
	let record = $state.raw<RatingRecord>();
	let learned = $state(0);
	let loaded = $state(false);
	let game = $state.raw<ArenaState>(startArena('w'));
	let before = $state(0);
	let round = $state(0);

	onMount(async () => {
		if (!course) return;
		[explorer, record, learned] = await Promise.all([
			loadExplorer(course.id),
			getRating('arena', course.id, ARENA_START),
			db.progress.where('courseId').equals(course.id).count()
		]);
		game = startArena(course.side, sharedPrefix(course));
		before = record.rating;
		loaded = true;
	});

	const plies = $derived.by((): Ply[] => {
		const chess = new Chess();
		return game.moves.map((uci) => {
			const fenBefore = chess.fen() as Fen;
			const m = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
			return { san: m.san as San, uci, color: m.color, fenBefore, fenAfter: chess.fen() as Fen };
		});
	});
	const last = $derived(plies.at(-1));

	$effect(() => {
		const s = game;
		if (!explorer || !record || s.kind !== 'opponent') return;
		const reply = sampleReply(explorer, s.fen, record.rating);
		const t = setTimeout(() => {
			if (!reply) return void (game = arenaStep(s, { type: 'outOfData' }));
			game = arenaStep(s, { type: 'move', uci: reply });
			play(plies.at(-1)?.san.includes('x') ? 'capture' : 'move');
		}, s.moves.length ? 550 : 700);
		return () => clearTimeout(t);
	});

	function studentCp(score: { cp?: number; mate?: number } | undefined, fen: Fen): number {
		if (!course) return 0;
		if (!score) {
			const chess = new Chess(fen);
			if (!chess.isCheckmate()) return 0;
			return chess.turn() === course.side ? -1000 : 1000;
		}
		const white = scoreCp(score as never, new Chess(fen).turn());
		return course.side === 'w' ? white : -white;
	}

	$effect(() => {
		const s = game;
		if (s.kind !== 'judging' || !course || !record) return;
		let cancelled = false;
		void (async () => {
			const engine = getEngine();
			await engine.ready();
			const [start, final] = await Promise.all([
				engine.analyse(START_FEN, { depth: JUDGE_DEPTH }),
				engine.analyse(s.fen, { depth: JUDGE_DEPTH })
			]);
			if (cancelled) return;
			const next = arenaStep(s, { type: 'judged', startCp: studentCp(start.lines[0]?.score, START_FEN), finalCp: studentCp(final.lines[0]?.score, s.fen) });
			if (next.kind !== 'done' || !record) return;
			game = next;
			const score = next.result === 'win' ? 1 : next.result === 'draw' ? 0.5 : 0;
			record = await recordResult(record, updateRating(record.rating, next.result), score);
			play(next.result === 'loss' ? 'wrong' : 'complete');
			void logSession({ mode: 'arena', courseId: course.id, lines: 1, mistakes: next.result === 'loss' ? 1 : 0 });
		})();
		return () => (cancelled = true);
	});

	function onmove(uci: string) {
		if (game.kind !== 'student') return;
		const next = arenaStep(game, { type: 'move', uci: uci as Uci });
		if (next === game) return;
		game = next;
		play(plies.at(-1)?.san.includes('x') ? 'capture' : 'move');
	}

	function again() {
		if (!course || !record) return;
		before = record.rating;
		game = startArena(course.side, sharedPrefix(course));
		round++;
	}

	const deviation = $derived(course && game.kind === 'done' ? findDeviation([course], plies, course.side) : undefined);
	const moveNo = (i: number) => `${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'}`;
	const pawns = (cp: number) => `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`;
</script>

<svelte:head><title>Arena · {course?.name ?? ''} · Chessmode</title></svelte:head>

{#if !course}
	<main class="page" style="padding-top:48px"><h1 class="h-title">Course not found</h1></main>
{:else if loaded && (learned < ARENA_UNLOCK_LINES || !explorer)}
	<main class="page locked">
		<img src="/img/empty/arena.webp" alt="" />
		<h1 class="h-title">Arena is locked</h1>
		<p class="muted">
			{#if !explorer}
				Player games for this opening aren't in yet.
			{:else}
				Learn {ARENA_UNLOCK_LINES - learned} more {ARENA_UNLOCK_LINES - learned === 1 ? 'line' : 'lines'} of {course.name}. You'll be playing them here soon.
			{/if}
		</p>
		<a class="btn btn-primary" href="/course/{course.id}">Back to the course</a>
	</main>
{:else if loaded && record}
	<PlayShell closeHref="/drill">
		{#snippet status()}
			<span class="rating"><small>Arena</small><b>{record?.rating}</b></span>
			<span class="muted opp">Opponents near {record?.rating}</span>
		{/snippet}
		{#snippet board()}
			{#key round}
				<Board
					fen={game.fen}
					orientation={course.side === 'w' ? 'white' : 'black'}
					movable={game.kind === 'student' ? course.side : 'none'}
					lastMove={last ? [last.uci.slice(0, 2), last.uci.slice(2, 4)] : undefined}
					{onmove}
				/>
			{/key}
		{/snippet}
		{#snippet panel()}
			<div class="title">
				<p class="label">{course.name}</p>
				<h1 class="h-title">Arena</h1>
			</div>
			<div class="prompt card" aria-live="polite">
				{#if game.kind === 'student'}
					<span class="dot you"></span><p><b>Your move.</b> Play your repertoire. Replies come from Lichess players near your rating.</p>
				{:else if game.kind === 'opponent'}
					<span class="dot opp"></span><p><b>Opponent thinking…</b></p>
				{:else if game.kind === 'judging'}
					<span class="dot opp"></span><p><b>Players at your level stop here.</b> The engine is judging the position.</p>
				{:else}
					<span class="dot good"></span><p><b>Game over.</b></p>
				{/if}
			</div>
			<div class="moves card">
				{#each plies as p, i (i)}
					<span class:mine={p.color === course.side}>{#if i % 2 === 0}<em>{moveNo(i)}</em>{/if}{p.san}</span>
				{:else}
					<span class="muted">Moves appear here.</span>
				{/each}
			</div>
			<p class="muted small">Finish more than half a pawn better than the starting position to win, half a pawn worse to lose.</p>
		{/snippet}
	</PlayShell>

	{#if game.kind === 'done'}
		{@const delta = record.rating - before}
		<ResultSheet
			image={game.result === 'win' ? '/img/result/win.webp' : game.result === 'draw' ? '/img/result/draw.webp' : undefined}
			expression={game.result === 'loss' ? 'wince' : undefined}
			eyebrow="Arena · {course.name}"
			title={game.result === 'win' ? 'You won the opening' : game.result === 'draw' ? 'An even opening' : 'You lost the opening'}
			subtitle={deviation?.kind === 'you'
				? `You left the course at ${moveNo(deviation.ply)} ${deviation.played.san}; it plays ${deviation.expected.san}.`
				: deviation?.kind === 'opponent'
					? `Your opponent left the course at ${moveNo(deviation.ply)} ${deviation.played.san}.`
					: 'You stayed in your repertoire.'}
			stats={[
				{ label: 'Rating', value: `${record.rating} (${delta >= 0 ? '+' : ''}${delta})`, tone: delta > 0 ? 'good' : delta < 0 ? 'bad' : undefined },
				{ label: 'Start', value: pawns(game.startCp) },
				{ label: 'Final', value: pawns(game.finalCp), tone: 'accent' }
			]}
		>
			{#snippet actions()}
				<button class="btn btn-primary block" onclick={again}>Play again</button>
				<a class="btn btn-surface block" href="/drill">Done</a>
			{/snippet}
		</ResultSheet>
	{/if}
{/if}

<style>
	.rating {
		display: grid;
		line-height: 1.1;
	}
	.rating small {
		font-size: 11px;
		color: var(--text-3);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.rating b {
		font: 600 20px var(--mono);
	}
	.opp {
		font-size: 13px;
	}
	.prompt {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		padding: 14px 16px;
		font-size: 15px;
		line-height: 1.45;
		color: var(--text-2);
	}
	.prompt b {
		color: var(--text);
		font-weight: 600;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-top: 6px;
		flex: 0 0 auto;
	}
	.dot.you {
		background: var(--accent);
		box-shadow: 0 0 0 4px var(--accent-soft);
	}
	.dot.opp {
		background: var(--text-3);
	}
	.dot.good {
		background: var(--good);
	}
	.moves {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		padding: 12px 14px;
		font: 13px/1.9 var(--mono);
		color: var(--text-2);
	}
	.moves em {
		font-style: normal;
		margin-right: 3px;
		color: var(--text-3);
	}
	.moves .mine {
		color: var(--text);
	}
	.small {
		font-size: 12px;
	}
	.locked {
		padding-top: 60px;
		display: grid;
		justify-items: center;
		text-align: center;
		gap: 12px;
	}
	.locked img {
		width: 120px;
		height: 120px;
		object-fit: contain;
	}
</style>
