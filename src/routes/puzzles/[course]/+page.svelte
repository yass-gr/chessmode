<script lang="ts">
	import { onMount } from 'svelte';
	import { Chess } from 'chess.js';
	import { page } from '$app/state';
	import Board, { type Marker } from '#lib/components/Board.svelte';
	import PlayShell from '#lib/components/play/PlayShell.svelte';
	import type { Fen, Uci } from '#lib/chess/types.ts';
	import { getCourse } from '#lib/courses/index.ts';
	import type { RatingRecord } from '#lib/db.ts';
	import { loadPuzzles, nextPuzzle, puzzleStep, startPuzzle, type Puzzle, type PuzzleState } from '#lib/puzzles/puzzles.ts';
	import { elo, getRating, PUZZLE_START, recordResult } from '#lib/ratings.ts';
	import { logSession } from '#lib/progress.ts';
	import { play } from '#lib/sound.ts';

	const course = $derived(getCourse(page.params.course ?? ''));
	let pool = $state.raw<Puzzle[]>([]);
	let record = $state.raw<RatingRecord>();
	let puzzle = $state.raw<Puzzle>();
	let game = $state.raw<PuzzleState>();
	let failed = $state(false);
	let change = $state(0);
	let solved = $state(0);
	let tried = $state(0);
	let showing = $state<Fen>();
	let loaded = $state(false);
	let flash = $state<Marker>();

	onMount(async () => {
		if (!course) return;
		[pool, record] = await Promise.all([loadPuzzles(course.id), getRating('puzzle', course.id, PUZZLE_START)]);
		loaded = true;
		next();
	});

	function next() {
		if (!record) return;
		puzzle = nextPuzzle(pool, record.rating, new Set(record.seen));
		game = puzzle ? startPuzzle(puzzle) : undefined;
		failed = false;
		change = 0;
		showing = undefined;
	}

	const solver = $derived(puzzle ? (puzzle.fen.split(' ')[1] === 'w' ? 'b' : 'w') : 'w');
	const lastMove = $derived.by((): [string, string] | undefined => {
		if (!puzzle || !game || game.kind === 'opponent') return undefined;
		const index = game.kind === 'solved' ? puzzle.moves.length : game.index;
		const uci = game.kind === 'wrong' ? game.played : puzzle.moves[index - 1];
		return uci ? [uci.slice(0, 2), uci.slice(2, 4)] : undefined;
	});
	const fen = $derived.by((): Fen | undefined => {
		if (showing) return showing;
		if (!game) return puzzle?.fen;
		if (game.kind !== 'wrong') return game.fen;
		const chess = new Chess(game.fen);
		chess.move({ from: game.played.slice(0, 2), to: game.played.slice(2, 4), promotion: game.played[4] || undefined });
		return chess.fen() as Fen;
	});

	$effect(() => {
		const s = game;
		if (!puzzle || !s || s.kind !== 'opponent') return;
		const p = puzzle;
		const t = setTimeout(() => {
			game = puzzleStep(p, s, { type: 'opponent' });
			play(p.moves[s.index] && new Chess(s.fen).get(p.moves[s.index].slice(2, 4) as never) ? 'capture' : 'move');
		}, s.index === 0 ? 700 : 450);
		return () => clearTimeout(t);
	});

	async function settle(score: 0 | 1) {
		if (!record || !puzzle || !course) return;
		const rating = elo(record.rating, puzzle.rating, score, 24);
		change = rating - record.rating;
		tried++;
		if (score) solved++;
		record = await recordResult(record, rating, score, puzzle.id);
		void logSession({ mode: 'puzzles', courseId: course.id, lines: score, mistakes: score ? 0 : 1 });
	}

	function onmove(uci: string) {
		if (!puzzle || !game || game.kind !== 'solving') return;
		const next = puzzleStep(puzzle, game, { type: 'move', uci: uci as Uci }, failed);
		if (next === game) return;
		game = next;
		if (next.kind === 'wrong') {
			play('wrong');
			if (!failed) {
				failed = true;
				void settle(0);
			}
			return;
		}
		flash = { square: uci.slice(2, 4), glyph: '✓', color: 'var(--good)', label: 'Correct' };
		setTimeout(() => (flash = undefined), 600);
		play(next.kind === 'solved' ? 'complete' : 'correct');
		if (next.kind === 'solved' && !failed) void settle(1);
	}

	function showSolution() {
		if (!puzzle || !game || game.kind === 'solved' || game.kind === 'opponent') return;
		const p = puzzle;
		const chess = new Chess(game.fen);
		const rest = p.moves.slice(game.index);
		game = { kind: 'solved', fen: game.fen, clean: false };
		rest.forEach((uci, i) =>
			setTimeout(() => {
				chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
				showing = chess.fen() as Fen;
				play('move');
			}, 500 * (i + 1))
		);
	}

	const themes: Record<string, string> = {
		mateIn1: 'Mate in 1', mateIn2: 'Mate in 2', mateIn3: 'Mate in 3', fork: 'Fork', pin: 'Pin', skewer: 'Skewer',
		hangingPiece: 'Hanging piece', discoveredAttack: 'Discovered attack', trappedPiece: 'Trapped piece', sacrifice: 'Sacrifice',
		deflection: 'Deflection', attraction: 'Attraction', doubleCheck: 'Double check', exposedKing: 'Exposed king', kingsideAttack: 'Kingside attack'
	};
	const theme = $derived(puzzle?.themes.map((t) => themes[t]).find(Boolean));
</script>

<svelte:head><title>Puzzles · {course?.name ?? ''} · Chessmode</title></svelte:head>

{#if !course}
	<main class="page" style="padding-top:48px"><h1 class="h-title">Course not found</h1></main>
{:else if loaded && !puzzle}
	<main class="page empty">
		<h1 class="h-title">No puzzles yet</h1>
		<p class="muted">There are no puzzles for {course.name} yet.</p>
		<a class="btn btn-primary" href="/drill">Back</a>
	</main>
{:else if loaded && puzzle && game && record}
	{@const p = puzzle}
	<PlayShell closeHref="/drill">
		{#snippet status()}
			<span class="rating"><small>Puzzles</small><b>{record?.rating}</b></span>
			{#if change}<em class="change" class:up={change > 0}>{change > 0 ? '+' : ''}{change}</em>{/if}
			<span class="muted tally">{solved}/{tried} solved</span>
		{/snippet}
		{#snippet board()}
			{#key p.id}
				<Board
					fen={fen ?? p.fen}
					orientation={solver === 'w' ? 'white' : 'black'}
					movable={game?.kind === 'solving' ? solver : 'none'}
					{lastMove}
					marker={game?.kind === 'wrong' ? { square: game.played.slice(2, 4), glyph: '✕', color: 'var(--bad)', label: 'Wrong' } : flash}
					{onmove}
				/>
			{/key}
		{/snippet}
		{#snippet panel()}
			<div class="title">
				<p class="label">{course.name} · {p.opening}</p>
				<h1 class="h-title">Punish the mistake</h1>
			</div>
			<div class="prompt card" class:bad={game?.kind === 'wrong'} aria-live="polite">
				{#if game?.kind === 'opponent'}
					<span class="dot opp"></span><p><b>Your opponent leaves the line…</b></p>
				{:else if game?.kind === 'solving'}
					<span class="dot you"></span><p><b>{solver === 'w' ? 'White' : 'Black'} to move.</b> Find the best move.</p>
				{:else if game?.kind === 'wrong'}
					<span class="dot bad"></span><p><b>Not the move.</b> {failed && change ? `Rating ${change}.` : ''} Try again or see the solution.</p>
				{:else}
					<span class="dot good"></span><p><b>{game?.clean ? 'Solved.' : 'Solution shown.'}</b> {theme ? `Theme: ${theme}.` : ''} Puzzle rated {p.rating}.</p>
				{/if}
			</div>
			<div class="actions">
				{#if game?.kind === 'wrong'}
					<button class="btn btn-primary block" onclick={() => game && (game = puzzleStep(p, game, { type: 'retry' }))}>Try again</button>
					<button class="btn btn-surface block" onclick={showSolution}>Show solution</button>
				{:else if game?.kind === 'solved'}
					<button class="btn btn-primary block" onclick={next}>Next puzzle</button>
				{:else if game?.kind === 'solving'}
					<button class="btn btn-surface block" onclick={() => { if (!failed) { failed = true; void settle(0); } showSolution(); }}>Show solution</button>
				{/if}
			</div>
			<a class="lichess muted" href="https://lichess.org/training/{p.id}" target="_blank" rel="noopener">Puzzle {p.id} from the Lichess database</a>
		{/snippet}
	</PlayShell>
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
	.change {
		font: 600 13px var(--mono);
		font-style: normal;
		color: var(--bad);
	}
	.change.up {
		color: var(--good);
	}
	.tally {
		margin-left: auto;
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
	.prompt.bad {
		border-color: rgba(255, 90, 82, 0.4);
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
	.dot.bad {
		background: var(--bad);
	}
	.dot.good {
		background: var(--good);
	}
	.actions {
		display: grid;
		gap: 8px;
	}
	.lichess {
		font-size: 12px;
	}
	.empty {
		padding-top: 60px;
		display: grid;
		gap: 12px;
		justify-items: center;
		text-align: center;
	}
</style>
