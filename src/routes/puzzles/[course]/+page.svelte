<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { Chess } from 'chess.js';
	import { page } from '$app/state';
	import Board, { type Marker } from '#lib/components/Board.svelte';
	import PlayShell from '#lib/components/play/PlayShell.svelte';
	import SettingsPanel from '#lib/components/settings/SettingsPanel.svelte';
	import type { Fen, Uci } from '#lib/chess/types.ts';
	import { getCourse } from '#lib/courses/index.ts';
	import { db, type RatingRecord } from '#lib/db.ts';
	import { reducedMotion } from '#lib/motion.ts';
	import { readOnboarding } from '#lib/onboarding/store.ts';
	import { logSession } from '#lib/progress.ts';
	import { loadPuzzles, nextPuzzle, puzzleStep, startPuzzle, type Puzzle, type PuzzleState } from '#lib/puzzles/puzzles.ts';
	import { missAttempt, PUZZLE_AUTO_NEXT_MS, solveAttempt, startAttempt, unseenIds, type PuzzleAttempt } from '#lib/puzzles/session.ts';
	import { clampStoredRating, elo, loadCourseRating, openingRating, recordResult, resetSeen } from '#lib/ratings.ts';
	import { opponentDelay, readCoursePreferences, readPreferences } from '#lib/settings/preferences.ts';
	import { DEFAULT_COURSE_PREFERENCES, DEFAULT_PREFERENCES, type CoursePreferences, type Preferences } from '#lib/settings/types.ts';
	import { play } from '#lib/sound.ts';

	const course = $derived(getCourse(page.params.course ?? ''));
	let pool = $state.raw<Puzzle[]>([]);
	let record = $state.raw<RatingRecord>();
	let puzzle = $state.raw<Puzzle>();
	let game = $state.raw<PuzzleState>();
	let attempt = $state<PuzzleAttempt>(startAttempt(0));
	let streak = $state(0);
	let change = $state(0);
	let solved = $state(0);
	let tried = $state(0);
	let showing = $state<Fen>();
	let loaded = $state(false);
	let flash = $state<Marker>();
	let preferences = $state<Preferences>({ ...DEFAULT_PREFERENCES });
	let coursePrefs = $state<CoursePreferences>({ ...DEFAULT_COURSE_PREFERENCES });
	let settingsOpen = $state(false);
	const timers = new Set<ReturnType<typeof setTimeout>>();

	function later(ms: number, run: () => void) {
		const timer = setTimeout(() => {
			timers.delete(timer);
			run();
		}, ms);
		timers.add(timer);
		return timer;
	}

	function clearTimers() {
		for (const timer of timers) clearTimeout(timer);
		timers.clear();
	}

	onMount(async () => {
		if (!course) return;
		const [puzzles, profile, rows, prefs, courseSettings] = await Promise.all([
			loadPuzzles(course.id),
			readOnboarding(),
			db.ratings.where('kind').equals('puzzle').toArray(),
			readPreferences(),
			readCoursePreferences(course.id)
		]);
		preferences = prefs;
		coursePrefs = courseSettings;
		pool = puzzles;
		const seed = openingRating({
			kind: 'puzzle',
			bracket: profile.bracket,
			others: rows.filter((row) => row.courseId !== course.id)
		});
		record = await loadCourseRating('puzzle', course.id, seed);
		loaded = true;
		await goNext();
	});

	onDestroy(clearTimers);

	async function goNext() {
		clearTimers();
		if (!record) return;
		const track = unseenIds(pool.map((item) => item.id), record.seen);
		if (track.reset) record = await resetSeen(record);
		puzzle = nextPuzzle(pool, record.rating, track.played);
		game = puzzle ? startPuzzle(puzzle) : undefined;
		attempt = startAttempt(streak);
		change = 0;
		showing = undefined;
		flash = undefined;
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
	const finished = $derived(attempt.feedback === 'solved' || attempt.feedback === 'recovered');

	$effect(() => {
		const s = game;
		const p = puzzle;
		const delay = opponentDelay('puzzles', coursePrefs);
		if (!p || !s || s.kind !== 'opponent') return;
		const timer = later(delay, () => {
			game = puzzleStep(p, s, { type: 'opponent' });
			play(p.moves[s.index] && new Chess(s.fen).get(p.moves[s.index].slice(2, 4) as never) ? 'capture' : 'move');
		});
		return () => clearTimeout(timer);
	});

	$effect(() => {
		const id = puzzle?.id;
		const feedback = attempt.feedback;
		const auto = preferences.autoNext;
		if (!auto || !id || (feedback !== 'solved' && feedback !== 'recovered')) return;
		const timer = later(PUZZLE_AUTO_NEXT_MS, () => {
			if (puzzle?.id === id) void goNext();
		});
		return () => clearTimeout(timer);
	});

	function haptic(ms: number) {
		if (!preferences.haptics || reducedMotion() || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
		navigator.vibrate(ms);
	}

	async function settle(score: 0 | 1) {
		if (!record || !puzzle || !course) return;
		const rating = clampStoredRating(elo(record.rating, puzzle.rating, score, 24));
		change = rating - record.rating;
		tried++;
		if (score) solved++;
		record = await recordResult(record, rating, score, puzzle.id);
		void logSession({ mode: 'puzzles', courseId: course.id, lines: score, mistakes: score ? 0 : 1 });
	}

	function onmove(uci: string) {
		if (!puzzle || !game || game.kind !== 'solving') return;
		const missed = attempt.charged || attempt.feedback === 'failed';
		const next = puzzleStep(puzzle, game, { type: 'move', uci: uci as Uci }, missed);
		if (next === game) return;
		game = next;
		if (next.kind === 'wrong') {
			play('wrong');
			haptic(30);
			const update = missAttempt(attempt);
			attempt = update.attempt;
			streak = update.attempt.streak;
			if (update.score !== null) void settle(update.score);
			return;
		}
		flash = { square: uci.slice(2, 4), glyph: '✓', color: 'var(--good)', label: 'Correct' };
		later(600, () => (flash = undefined));
		play(next.kind === 'solved' ? 'complete' : 'correct');
		if (next.kind !== 'solved') return;
		const update = solveAttempt(attempt, next.clean);
		attempt = update.attempt;
		streak = update.attempt.streak;
		if (update.score !== null) void settle(update.score);
		if (update.attempt.feedback === 'solved') haptic(12);
	}

	function showSolution() {
		if (!puzzle || !game || game.kind === 'solved' || game.kind === 'opponent') return;
		const update = missAttempt(attempt);
		attempt = update.attempt;
		streak = update.attempt.streak;
		if (update.score !== null) void settle(update.score);
		const p = puzzle;
		const chess = new Chess(game.fen);
		const rest = p.moves.slice(game.index);
		game = { kind: 'solved', fen: game.fen, clean: false };
		rest.forEach((uci, i) =>
			later(500 * (i + 1), () => {
				chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
				showing = chess.fen() as Fen;
				play('move');
			})
		);
	}

	function retry() {
		if (!puzzle || !game || game.kind !== 'wrong') return;
		clearTimers();
		showing = undefined;
		game = puzzleStep(puzzle, game, { type: 'retry' });
	}

	const themes: Record<string, string> = {
		mateIn1: 'Mate in 1', mateIn2: 'Mate in 2', mateIn3: 'Mate in 3', fork: 'Fork', pin: 'Pin', skewer: 'Skewer',
		hangingPiece: 'Hanging piece', discoveredAttack: 'Discovered attack', trappedPiece: 'Trapped piece', sacrifice: 'Sacrifice',
		deflection: 'Deflection', attraction: 'Attraction', doubleCheck: 'Double check', exposedKing: 'Exposed king', kingsideAttack: 'Kingside attack'
	};
	const theme = $derived(puzzle?.themes.map((item) => themes[item]).find(Boolean));
	const text = $derived(preferences.textSize);
</script>

<svelte:head><title>Puzzles · {course?.name ?? ''} · Chessmode</title></svelte:head>

{#if !course}
	<main class="page" style="padding-top:48px"><h1 class="h-title">Course not found</h1></main>
{:else if loaded && !puzzle}
	<main class="page empty">
		<img src="/img/mascot/neutral.webp" alt="" />
		<h1 class="h-title">No puzzles yet</h1>
		<p class="muted">There are no puzzles for {course.name} yet.</p>
		<a class="btn btn-primary" href="/course/{course.id}">Back to the course</a>
	</main>
{:else if loaded && puzzle && game && record}
	{@const p = puzzle}
	<PlayShell closeHref="/course/{course.id}">
		{#snippet status()}
			<span class="rating"><small>Puzzles</small><b>{record?.rating}</b></span>
			{#if change}<em class="change" class:up={change > 0}>{change > 0 ? '+' : ''}{change}</em>{/if}
			<span class="muted tally">Streak {streak} · {solved}/{tried}</span>
		{/snippet}
		{#snippet board()}
			{#key p.id}
				<Board
					fen={fen ?? p.fen}
					orientation={solver === 'w' ? 'white' : 'black'}
					movable={game?.kind === 'solving' || game?.kind === 'opponent' ? solver : 'none'}
					{lastMove}
					marker={game?.kind === 'wrong' ? { square: game.played.slice(2, 4), glyph: '✕', color: 'var(--bad)', label: 'Wrong' } : flash}
					theme={preferences.theme}
					pieces={preferences.pieces}
					premove={{ session: p.id }}
					{onmove}
				/>
			{/key}
		{/snippet}
		{#snippet panel()}
			<div class="trainer" data-text={text}>
				<div class="title">
					<p class="label">{course.name} · {p.opening}</p>
					<h1 class="h-title">Punish the mistake</h1>
				</div>
				<div class="prompt card" class:bad={game?.kind === 'wrong' || attempt.feedback === 'failed'} class:good={attempt.feedback === 'recovered' || attempt.feedback === 'solved'} aria-live="polite">
					{#if attempt.feedback === 'solved' && preferences.confetti && !reducedMotion()}
						<div class="confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
					{/if}
					{#if game?.kind === 'opponent'}
						<span class="dot opp"></span><p><b>Your opponent leaves the line…</b></p>
					{:else if game?.kind === 'solving'}
						<span class="dot you"></span><p><b>{solver === 'w' ? 'White' : 'Black'} to move.</b> Find the punishment.</p>
					{:else if game?.kind === 'wrong'}
						<span class="dot bad"></span>
						<p><b>Not the move.</b> {change ? `Rating ${change > 0 ? '+' : ''}${change}.` : ''} One miss is the whole loss. Find the move, or see it.</p>
					{:else if attempt.feedback === 'recovered'}
						<span class="dot good"></span>
						<p><b>Recovered.</b> You found it after a miss. Your rating already counted the miss, so it does not change again.</p>
					{:else if attempt.feedback === 'failed'}
						<span class="dot bad"></span><p><b>Solution shown.</b> {theme ? `${theme}. ` : ''}The miss is the only rating change.</p>
					{:else}
						<span class="dot good"></span><p><b>Solved.</b> {theme ? `${theme}. ` : ''}Puzzle rated {p.rating}. Streak {streak}.</p>
					{/if}
				</div>
				<div class="actions">
					{#if game?.kind === 'wrong'}
						<button class="btn btn-primary block" onclick={retry}>Try again</button>
						<button class="btn btn-surface block" onclick={showSolution}>Show solution</button>
					{:else if finished && !preferences.autoNext}
						<button class="btn btn-primary block" onclick={() => void goNext()}>Next puzzle</button>
					{:else if finished}
						<p class="muted wait">Next puzzle follows.</p>
					{:else if game?.kind === 'solving'}
						<button class="btn btn-surface block" onclick={showSolution}>Show solution</button>
					{:else if attempt.feedback === 'failed'}
						<button class="btn btn-primary block" onclick={() => void goNext()}>Next puzzle</button>
					{/if}
				</div>
				<button class="btn btn-surface block" type="button" aria-expanded={settingsOpen} onclick={() => (settingsOpen = !settingsOpen)}>
					{settingsOpen ? 'Hide settings' : 'Settings'}
				</button>
				{#if settingsOpen}
					<div class="card settings">
						<SettingsPanel mode="puzzles" courseId={course.id} onchange={(next, nextCourse) => { preferences = next; coursePrefs = nextCourse; }} />
					</div>
				{/if}
				<a class="lichess muted" href="https://lichess.org/training/{p.id}" target="_blank" rel="noopener">Puzzle {p.id} from the Lichess database (CC0)</a>
			</div>
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
	.trainer {
		display: grid;
		gap: 12px;
	}
	.prompt {
		position: relative;
		display: flex;
		gap: 12px;
		align-items: flex-start;
		padding: 14px 16px;
		font-size: 15px;
		line-height: 1.45;
		color: var(--text-2);
		overflow: hidden;
	}
	.trainer[data-text='large'] .prompt {
		font-size: 17px;
	}
	.trainer[data-text='xl'] .prompt {
		font-size: 19px;
	}
	.prompt.bad {
		border-color: rgba(255, 90, 82, 0.4);
	}
	.prompt.good {
		border-color: rgba(62, 207, 142, 0.4);
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
	.wait {
		font-size: 13px;
		text-align: center;
	}
	.settings {
		padding: 14px;
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
	.empty img {
		width: 120px;
	}
	.confetti {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.confetti i {
		position: absolute;
		top: 8px;
		left: 50%;
		width: 6px;
		height: 8px;
		border-radius: 1px;
		background: var(--accent);
		animation: burst var(--dur-push) var(--ease-out) both;
	}
	.confetti i:nth-child(2) {
		background: var(--good);
		animation-delay: 40ms;
	}
	.confetti i:nth-child(3) {
		background: var(--accent);
		animation-delay: 80ms;
	}
	.confetti i:nth-child(4) {
		background: var(--good);
		animation-delay: 20ms;
	}
	.confetti i:nth-child(5) {
		background: var(--accent);
		animation-delay: 60ms;
	}
	@keyframes burst {
		from {
			transform: translate(0, 0);
			opacity: 1;
		}
		to {
			transform: translate(var(--x, 24px), 28px);
			opacity: 0;
		}
	}
	.confetti i:nth-child(1) {
		--x: -36px;
	}
	.confetti i:nth-child(2) {
		--x: -16px;
	}
	.confetti i:nth-child(3) {
		--x: 8px;
	}
	.confetti i:nth-child(4) {
		--x: 28px;
	}
	.confetti i:nth-child(5) {
		--x: 44px;
	}
</style>
