<script lang="ts">
	import { onMount } from 'svelte';
	import { Chess } from 'chess.js';
	import { page } from '$app/state';
	import ArenaReview from '#lib/components/arena/ArenaReview.svelte';
	import Board from '#lib/components/Board.svelte';
	import PlayShell from '#lib/components/play/PlayShell.svelte';
	import EvalBar from '#lib/components/review/EvalBar.svelte';
	import ResultSheet from '#lib/components/train/ResultSheet.svelte';
	import SettingsPanel from '#lib/components/settings/SettingsPanel.svelte';
	import { START_FEN, turnOf, type Fen, type Ply, type San, type Uci } from '#lib/chess/types.ts';
	import { getCourse } from '#lib/courses/index.ts';
	import { db, type RatingRecord } from '#lib/db.ts';
	import { getEngine } from '#lib/engine/stockfish.ts';
	import { ARENA_MARGIN_CP, ARENA_START, ARENA_UNLOCK_LINES, arenaStep, sampleReply, sharedPrefix, startArena, updateRating, type ArenaState } from '#lib/explorer/arena.ts';
	import { arenaPgn, seriesMoves, variationSan } from '#lib/explorer/arena-review.ts';
	import { loadExplorer, type Explorer } from '#lib/explorer/types.ts';
	import { parsePgn } from '#lib/import/pgn.ts';
	import { readOnboarding } from '#lib/onboarding/store.ts';
	import { logSession } from '#lib/progress.ts';
	import { loadCourseRating, nearestPickerRating, openingRating, ratingPickerValues, recordResult, setBaseline } from '#lib/ratings.ts';
	import { findDeviation } from '#lib/review/repertoire.ts';
	import { scoreCp } from '#lib/review/classify.ts';
	import type { Score } from '#lib/review/types.ts';
	import { opponentDelay, readCoursePreferences, readPreferences, showEvaluation } from '#lib/settings/preferences.ts';
	import { DEFAULT_COURSE_PREFERENCES, DEFAULT_PREFERENCES, type CoursePreferences, type Preferences } from '#lib/settings/types.ts';
	import { play } from '#lib/sound.ts';

	const JUDGE_DEPTH = 14;
	const LIVE_DEPTH = 12;
	const course = $derived(getCourse(page.params.course ?? ''));
	let explorer = $state.raw<Explorer>();
	let record = $state.raw<RatingRecord>();
	let learned = $state(0);
	let loaded = $state(false);
	let phase = $state<'setup' | 'play'>('setup');
	let game = $state.raw<ArenaState>(startArena('w'));
	let before = $state(0);
	let round = $state(0);
	let picked = $state<number | null>(null);
	let reviewing = $state(false);
	let reviewPly = $state(0);
	let savedId = $state('');
	let variation = $state('');
	let reviewScore = $state<Score>();
	let evalNote = $state('');
	let liveScore = $state<Score>();
	let liveTurn = $state<'w' | 'b'>('w');
	let samples = $state.raw<Record<string, number>>({});
	let preferences = $state<Preferences>({ ...DEFAULT_PREFERENCES });
	let coursePrefs = $state<CoursePreferences>({ ...DEFAULT_COURSE_PREFERENCES });
	let settingsOpen = $state(false);
	let judgeClaim = 0;

	onMount(async () => {
		if (!course) return;
		const [book, profile, rows, learnedCount, prefs, courseSettings] = await Promise.all([
			loadExplorer(course.id),
			readOnboarding(),
			db.ratings.where('kind').equals('arena').toArray(),
			db.progress.where('courseId').equals(course.id).count(),
			readPreferences(),
			readCoursePreferences(course.id)
		]);
		explorer = book;
		learned = learnedCount;
		preferences = prefs;
		coursePrefs = courseSettings;
		const seed = openingRating({
			kind: 'arena',
			bracket: profile.bracket,
			others: rows.filter((row) => row.courseId !== course.id),
			fallback: ARENA_START
		});
		record = await loadCourseRating('arena', course.id, seed);
		game = startArena(course.side, sharedPrefix(course));
		before = record.rating;
		loaded = true;
	});

	const plies = $derived.by((): Ply[] => {
		const chess = new Chess();
		return game.moves.map((uci) => {
			const fenBefore = chess.fen() as Fen;
			const move = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
			return { san: move.san as San, uci, color: move.color, fenBefore, fenAfter: chess.fen() as Fen };
		});
	});
	const last = $derived(plies.at(-1));
	const showEval = $derived(showEvaluation('arena', preferences));
	const picker = $derived.by(() => {
		const steps = ratingPickerValues();
		if (!record || steps.includes(record.rating)) return steps;
		return [...steps, record.rating].sort((a, b) => a - b);
	});
	const graphMoves = $derived(seriesMoves(plies, plies.map((ply) => samples[ply.fenAfter] ?? 0)));
	const graphIncomplete = $derived(plies.some((ply) => samples[ply.fenAfter] === undefined));

	$effect(() => {
		const s = game;
		if (phase !== 'play' || !explorer || !record || s.kind !== 'opponent') return;
		const rating = record.rating;
		const book = explorer;
		const delay = opponentDelay('arena', coursePrefs);
		const reply = sampleReply(book, s.fen, rating);
		const timer = setTimeout(() => {
			if (!reply) {
				game = arenaStep(s, { type: 'outOfData' });
				return;
			}
			game = arenaStep(s, { type: 'move', uci: reply });
			play(new Chess(s.fen).get(reply.slice(2, 4) as never) ? 'capture' : 'move');
		}, delay);
		return () => clearTimeout(timer);
	});

	function studentCp(score: Score | undefined, fen: Fen): number {
		if (!course) return 0;
		if (!score) {
			const chess = new Chess(fen);
			if (!chess.isCheckmate()) return 0;
			return chess.turn() === course.side ? -1000 : 1000;
		}
		const white = scoreCp(score, turnOf(fen));
		return course.side === 'w' ? white : -white;
	}

	function remember(fen: Fen, score: Score | undefined) {
		if (!score || score.cp === undefined && score.mate === undefined) return;
		const white = score.cp !== undefined ? score.cp : scoreCp(score, turnOf(fen));
		samples = { ...samples, [fen]: white };
	}

	$effect(() => {
		const fen = game.fen;
		const active = phase === 'play' && !reviewing && (game.kind === 'student' || game.kind === 'opponent');
		if (!showEval || !active) return;
		const ac = new AbortController();
		liveTurn = turnOf(fen);
		void getEngine()
			.analyse(fen, { depth: LIVE_DEPTH, signal: ac.signal })
			.then((analysis) => {
				if (ac.signal.aborted) return;
				const score = analysis.lines[0]?.score;
				liveScore = score;
				remember(fen, score);
			})
			.catch((error: unknown) => {
				if (ac.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
				liveScore = undefined;
			});
		return () => ac.abort();
	});

	$effect(() => {
		const s = game;
		if (s.kind !== 'judging' || phase !== 'play' || !course || !record) return;
		const claim = ++judgeClaim;
		const played = s;
		const current = record;
		const side = course.side;
		const name = course.name;
		const id = course.id;
		let stop = false;
		const ac = new AbortController();
		void (async () => {
			try {
				const engine = getEngine();
				await engine.ready();
				const [start, final] = await Promise.all([
					engine.analyse(START_FEN, { depth: JUDGE_DEPTH, signal: ac.signal }),
					engine.analyse(played.fen, { depth: JUDGE_DEPTH, signal: ac.signal })
				]);
				if (stop || claim !== judgeClaim) return;
				const next = arenaStep(played, {
					type: 'judged',
					startCp: studentCp(start.lines[0]?.score, START_FEN),
					finalCp: studentCp(final.lines[0]?.score, played.fen)
				});
				if (next.kind !== 'done') return;
				remember(START_FEN, start.lines[0]?.score);
				remember(played.fen, final.lines[0]?.score);
				game = next;
				const score = next.result === 'win' ? 1 : next.result === 'draw' ? 0.5 : 0;
				const rating = updateRating(current.rating, next.result);
				record = await recordResult(current, rating, score);
				try {
					savedId = await storeGame(next.moves, side, next.result, before, name);
				} catch {
					savedId = '';
				}
				play(next.result === 'loss' ? 'wrong' : 'complete');
				void logSession({ mode: 'arena', courseId: id, lines: 1, mistakes: next.result === 'loss' ? 1 : 0 });
			} catch (error) {
				if (stop || claim !== judgeClaim) return;
				if (error instanceof DOMException && error.name === 'AbortError') return;
				game = arenaStep(played, { type: 'judgeFailed' });
			}
		})();
		return () => {
			stop = true;
			ac.abort();
		};
	});

	async function storeGame(moves: Uci[], side: 'w' | 'b', result: 'win' | 'draw' | 'loss', rating: number, name: string) {
		const parsed = parsePgn(arenaPgn(moves, { side, result, rating, course: name }));
		const stored = { ...parsed, userColor: side, termination: 'adjudication' };
		await db.games.put(stored);
		return stored.id;
	}

	function onmove(uci: string) {
		if (game.kind !== 'student') return;
		const next = arenaStep(game, { type: 'move', uci: uci as Uci });
		if (next === game) return;
		game = next;
		play(plies.at(-1)?.san.includes('x') ? 'capture' : 'move');
	}

	async function begin() {
		if (!course || !record) return;
		if (picked !== null && picked !== record.rating) record = await setBaseline(record, picked);
		before = record.rating;
		reviewing = false;
		savedId = '';
		samples = {};
		variation = '';
		game = startArena(course.side, sharedPrefix(course));
		round++;
		phase = 'play';
	}

	function again() {
		if (!course || !record) return;
		before = record.rating;
		reviewing = false;
		savedId = '';
		samples = {};
		variation = '';
		reviewPly = 0;
		game = startArena(course.side, sharedPrefix(course));
		round++;
		phase = 'play';
	}

	function retryJudge() {
		if (game.kind !== 'judgeError') return;
		game = arenaStep(game, { type: 'retryJudge' });
	}

	function openReview() {
		reviewing = true;
		reviewPly = plies.length;
		void readPly(plies.length);
	}

	async function readPly(next: number) {
		reviewPly = next;
		const fen = next <= 0 ? (plies[0]?.fenBefore ?? game.fen) : plies[next - 1].fenAfter;
		const ac = new AbortController();
		try {
			const analysis = await getEngine().analyse(fen, { depth: LIVE_DEPTH, signal: ac.signal });
			if (reviewPly !== next) return;
			const line = analysis.lines[0];
			reviewScore = line?.score;
			variation = line ? variationSan(fen, line.pv) : '';
			evalNote = line ? '' : 'Evaluation unavailable for this position.';
			remember(fen, line?.score);
		} catch {
			if (reviewPly !== next) return;
			reviewScore = undefined;
			variation = '';
			evalNote = 'The engine could not read this position. The game result is unchanged.';
		}
	}

	const deviation = $derived(course && game.kind === 'done' ? findDeviation([course], plies, course.side) : undefined);
	const moveNo = (i: number) => `${Math.floor(i / 2) + 1}${i % 2 ? '…' : '.'}`;
	const pawns = (cp: number) => `${cp >= 0 ? '+' : ''}${(cp / 100).toFixed(1)}`;
	const selectable = $derived(phase === 'play' && (game.kind === 'student' || game.kind === 'opponent'));
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
	<PlayShell closeHref="/course/{course.id}">
		{#snippet status()}
			<span class="rating"><small>Arena</small><b>{record?.rating}</b></span>
			<span class="muted opp">{phase === 'setup' ? 'Set a rating, then play' : `Opponents near ${record?.rating}`}</span>
		{/snippet}
		{#snippet board()}
			{#if reviewing && game.kind === 'done'}
				<ArenaReview
					{plies}
					moves={graphMoves}
					ply={reviewPly}
					score={reviewScore}
					turn={reviewPly <= 0 ? turnOf(plies[0]?.fenBefore ?? game.fen) : turnOf(plies[reviewPly - 1]?.fenAfter ?? game.fen)}
					{variation}
					evalNote={graphIncomplete ? 'Some positions are still being read.' : evalNote}
					reviewHref={savedId ? `/review/${savedId}` : ''}
					orientation={course.side}
					theme={preferences.theme}
					pieces={preferences.pieces}
					onselect={(ply) => void readPly(ply)}
					onagain={again}
				/>
			{:else}
				<div class="board-frame" class:bare={!showEval}>
					{#if showEval}
						<EvalBar score={liveScore} turn={liveTurn} orientation={course.side} loading={phase === 'play' && !liveScore && game.kind !== 'done'} />
					{/if}
					<div class="board-slot">
						{#key round}
							<Board
								fen={game.fen}
								orientation={course.side === 'w' ? 'white' : 'black'}
								movable={selectable ? course.side : 'none'}
								lastMove={last ? [last.uci.slice(0, 2), last.uci.slice(2, 4)] : undefined}
								theme={preferences.theme}
								pieces={preferences.pieces}
								premove={selectable ? { session: `arena-${round}` } : undefined}
								{onmove}
							/>
						{/key}
					</div>
				</div>
			{/if}
		{/snippet}
		{#snippet panel()}
			<div class="trainer" data-text={preferences.textSize}>
				<div class="title">
					<p class="label">{course.name}</p>
					<h1 class="h-title">{reviewing ? 'Game review' : 'Arena'}</h1>
				</div>
				{#if phase === 'setup'}
					<div class="prompt card" aria-live="polite">
						<span class="dot you"></span>
						<p><b>Choose the rating you want to face.</b> Stored rating {record?.rating}. Steps run from 400 to 3000. The rating saved after a game stays between 100 and 3000.</p>
					</div>
					<label class="field">
						Baseline
						<select value={picked ?? record?.rating} onchange={(event) => (picked = Number(event.currentTarget.value))}>
							{#each picker as value (value)}
								<option {value}>{value}{value === record?.rating && !ratingPickerValues().includes(value) ? ' (current)' : ''}</option>
							{/each}
						</select>
					</label>
					<p class="muted small">Nearest step is {nearestPickerRating(record?.rating ?? 950)}. Leaving the current rating selected keeps it. Changing the step sets a new baseline and does not count as a game.</p>
					<button class="btn btn-primary block" onclick={() => void begin()}>Play</button>
				{:else if !reviewing}
					<div class="prompt card" class:bad={game.kind === 'judgeError'} aria-live="polite">
						{#if game.kind === 'student'}
							<span class="dot you"></span><p><b>Your move.</b> Replies are weighted from Lichess games near {record?.rating}.</p>
						{:else if game.kind === 'opponent'}
							<span class="dot opp"></span><p><b>Opponent thinking…</b></p>
						{:else if game.kind === 'judging'}
							<span class="dot opp"></span><p><b>Adjudicating.</b> The book has run out. The engine is comparing this position with the start. Half a pawn better is a win, half a pawn worse is a loss.</p>
						{:else if game.kind === 'judgeError'}
							<span class="dot bad"></span><p><b>The engine did not return a verdict.</b> The game is not scored. Try the evaluation again.</p>
						{:else}
							<span class="dot good"></span><p><b>Game over.</b> {pawns(game.startCp)} at the start, {pawns(game.finalCp)} at the end.</p>
						{/if}
					</div>
					{#if game.kind === 'judgeError'}
						<button class="btn btn-primary block" onclick={retryJudge}>Try adjudication again</button>
					{/if}
					<div class="moves card">
						{#each plies as ply, index (index)}
							<span class:mine={ply.color === course.side}>{#if index % 2 === 0}<em>{moveNo(index)}</em>{/if}{ply.san}</span>
						{:else}
							<span class="muted">Moves appear here.</span>
						{/each}
					</div>
					<p class="muted small">A win needs more than {ARENA_MARGIN_CP / 100} pawns of improvement on the starting position, from your side.</p>
				{:else}
					<p class="muted small">Step through the game, read the engine line, then open the full analysis for every move.</p>
					{#if savedId}
						<a class="btn btn-surface block" href="/review/{savedId}">Full analysis</a>
					{/if}
					<button class="btn btn-primary block" onclick={again}>Play again</button>
				{/if}
				<button class="btn btn-surface block" type="button" aria-expanded={settingsOpen} onclick={() => (settingsOpen = !settingsOpen)}>
					{settingsOpen ? 'Hide settings' : 'Settings'}
				</button>
				{#if settingsOpen}
					<div class="card settings">
						<SettingsPanel
							mode="arena"
							courseId={course.id}
							onchange={(next, nextCourse) => {
								preferences = next;
								coursePrefs = nextCourse;
							}}
						/>
					</div>
				{/if}
			</div>
		{/snippet}
	</PlayShell>

	{#if game.kind === 'done' && !reviewing}
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
				{ label: 'Before', value: String(before) },
				{ label: 'Final', value: pawns(game.finalCp), tone: 'accent' }
			]}
		>
			{#snippet actions()}
				<button class="btn btn-primary block" onclick={openReview}>Review the game</button>
				<button class="btn btn-surface block" onclick={again}>Play again</button>
				<button class="btn btn-surface block" onclick={() => { if (!course) return; reviewing = false; picked = null; game = startArena(course.side, sharedPrefix(course)); phase = 'setup'; }}>Adjust rating</button>
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
	.board-frame {
		display: grid;
		grid-template-columns: 28px minmax(0, 1fr);
		gap: 8px;
		align-items: stretch;
	}
	.board-frame.bare {
		grid-template-columns: minmax(0, 1fr);
	}
	.board-slot {
		min-width: 0;
	}
	.trainer {
		display: grid;
		gap: 12px;
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
	.trainer[data-text='large'] .prompt {
		font-size: 17px;
	}
	.trainer[data-text='xl'] .prompt {
		font-size: 19px;
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
	.field {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.field select {
		margin-left: auto;
		background: var(--surface-2);
		color: var(--text);
		border: 1px solid var(--surface-4);
		border-radius: var(--r-sm);
		padding: 8px;
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
	.settings {
		padding: 14px;
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
