<script lang="ts">
	import { seg } from '#lib/components/seg.ts';
	import { page } from '$app/state';
	import Board, { type Arrow, type Marker } from '#lib/components/Board.svelte';
	import EvalGraph from '#lib/components/review/EvalGraph.svelte';
	import Label from '#lib/components/review/Label.svelte';
	import Summary from '#lib/components/review/Summary.svelte';
	import { START_FEN, other, type Color, type Ply, type Uci } from '#lib/chess/types.ts';
	import { db, getSetting, setSetting } from '#lib/db.ts';
	import { readPgn } from '#lib/import/pgn.ts';
	import { DEFAULT_DEPTH, DEPTHS, DEPTH_SETTING, reviewGame, type ReviewDepth, type ReviewProgress } from '#lib/review/analyse.ts';
	import { CLASSIFICATIONS, expectedPoints } from '#lib/review/classify.ts';
	import { isRetryable, lineMoves, retryMove, transition, type ReviewState } from '#lib/review/session.ts';
	import type { GameRecord, GameReview, Score } from '#lib/review/types.ts';
	import { courses } from '#lib/courses/index.ts';
	import { findDeviation } from '#lib/review/repertoire.ts';

	let game = $state<GameRecord>();
	let plies = $state<Ply[]>([]);
	let review = $state<GameReview>();
	let progress = $state<ReviewProgress>();
	let session = $state<ReviewState>({ kind: 'analysing', ply: 0 });
	let depth = $state<ReviewDepth>(DEFAULT_DEPTH);
	let orientation = $state<Color>('w');
	let retrySide = $state<Color>('w');
	let tab = $state<'moves' | 'summary'>('moves');
	let status = $state('');
	let error = $state('');
	let analysis: AbortController | undefined;
	let retryCheck: AbortController | undefined;
	let touch: { x: number; y: number } | undefined;
	let moveList = $state<HTMLDivElement>();
	const promotions = [{ piece: 'Queen', key: 'q' }, { piece: 'Rook', key: 'r' }, { piece: 'Bishop', key: 'b' }, { piece: 'Knight', key: 'n' }];

	const deviation = $derived(plies.length ? findDeviation(courses, plies, game?.userColor) : undefined);
	let deviationLearned = $state(false);
	$effect(() => {
		const key = deviation?.line;
		deviationLearned = false;
		if (key) void db.progress.get(key).then((row) => (deviationLearned = !!row && deviation?.line === key));
	});
	const deviationHref = $derived.by(() => {
		if (!deviation) return '';
		if (deviationLearned) return `/practice/run?line=${encodeURIComponent(deviation.line)}`;
		const line = deviation.course.lines.find((l) => l.key === deviation.line);
		return `/learn/${deviation.course.id}/${line?.id ?? ''}`;
	});
	const reviewed = $derived(progress?.moves ?? []);
	const position = $derived(plies[session.ply - 1]);
	const current = $derived(reviewed[session.ply - 1]);
	const keyMoments = $derived(reviewed.filter(move => isRetryable(move) || move.classification === 'find' || move.classification === 'sharp'));
	const retryable = $derived(review?.moves.filter(move => move.color === retrySide && isRetryable(move)) ?? []);
	const started = $derived(session.kind === 'showingLine' || session.kind === 'retrying');
	const variation = $derived(session.kind === 'showingLine' ? session.line[session.step - 1]
		: session.kind === 'retrying' && session.attempt.kind === 'solved' ? session.attempt.move : undefined);
	const fen = $derived(started && position ? variation?.fen ?? position.fenBefore : position?.fenAfter ?? plies[0]?.fenBefore ?? START_FEN);
	const lastMove = $derived(squares(variation?.uci ?? (started ? undefined : position?.uci)));
	const score = $derived(session.kind === 'showingLine' || session.kind === 'retrying' ? current?.best.score
		: session.ply ? current?.scoreAfter : progress?.initialScore);
	const win = $derived(score ? expectedPoints(score, orientation, started ? position?.color ?? 'w' : position ? other(position.color) : plies[0]?.color ?? 'w') * 100 : 50);
	const marker = $derived.by((): Marker | undefined => {
		if (!current || started) return;
		const info = CLASSIFICATIONS[current.classification];
		return { square: current.uci.slice(2, 4), glyph: info.glyph, color: info.color, label: info.label };
	});
	const arrows = $derived.by((): Arrow[] => {
		if (started || !current || current.uci === current.best.uci) return [];
		return [
			{ from: current.uci.slice(0, 2), to: current.uci.slice(2, 4), brush: 'muted' },
			{ from: current.best.uci.slice(0, 2), to: current.best.uci.slice(2, 4), brush: 'good' }
		];
	});
	const rows = $derived.by(() => {
		const groups: { number: number; white?: number; black?: number }[] = [];
		for (const [index, ply] of plies.entries()) {
			const number = Number(ply.fenBefore.split(' ')[5]);
			let row = groups.at(-1);
			if (!row || row.number !== number) {
				row = { number };
				groups.push(row);
			}
			row[ply.color === 'w' ? 'white' : 'black'] = index + 1;
		}
		return groups;
	});

	$effect(() => {
		const id = page.params.id;
		const load = new AbortController();
		game = undefined;
		error = '';
		void (async () => {
			try {
				const [record, preference] = await Promise.all([
					id ? db.games.get(id) : undefined,
					getSetting<number>(DEPTH_SETTING, DEFAULT_DEPTH)
				]);
				if (load.signal.aborted) return;
				if (!record) {
					error = 'This game is missing from your saved matches.';
					return;
				}
				session = { kind: 'analysing', ply: 0 };
				tab = 'moves';
				game = record;
				plies = readPgn(record.pgn).plies;
				depth = DEPTHS.find(option => option.value === preference)?.value ?? DEFAULT_DEPTH;
				orientation = record.userColor ?? 'w';
				retrySide = orientation;
				await runAnalysis();
			} catch (cause) {
				if (!load.signal.aborted) error = cause instanceof Error ? cause.message : 'Could not open this game.';
			}
		})();
		return () => {
			load.abort();
			analysis?.abort();
			retryCheck?.abort();
		};
	});

	$effect(() => {
		const active = session.ply;
		if (!moveList || !active) return;
		const selected = moveList.querySelector<HTMLButtonElement>('[aria-current="step"]');
		if (!selected) return;
		const bounds = moveList.getBoundingClientRect();
		const row = selected.getBoundingClientRect();
		if (row.bottom > bounds.bottom) moveList.scrollTop += row.bottom - bounds.bottom;
		else if (row.top < bounds.top) moveList.scrollTop += row.top - bounds.top;
	});

	async function runAnalysis(chosen: ReviewDepth = depth) {
		if (!game) return;
		analysis?.abort();
		const run = new AbortController();
		analysis = run;
		session = transition(session, { type: 'analysisStarted' });
		error = '';
		status = '';
		progress = undefined;
		review = undefined;
		try {
			const result = await reviewGame(game, {
				depth: chosen, plies: $state.snapshot(plies), signal: run.signal,
				onProgress: value => { if (!run.signal.aborted) progress = value; }
			});
			if (!run.signal.aborted) review = result;
		} catch (cause) {
			if (!run.signal.aborted) error = cause instanceof Error ? cause.message : 'Analysis could not finish.';
		} finally {
			if (!run.signal.aborted) session = transition(session, { type: 'analysisEnded' });
		}
	}

	async function changeDepth(value: string) {
		const selected = DEPTHS.find(option => String(option.value) === value);
		if (!selected || selected.value === depth) return;
		depth = selected.value;
		const pending = runAnalysis(depth);
		try {
			await setSetting(DEPTH_SETTING, selected.value);
		} catch {
			status = 'Could not remember the depth setting.';
		}
		await pending;
	}

	function squares(uci?: Uci): [string, string] | undefined {
		if (uci) return [uci.slice(0, 2), uci.slice(2, 4)];
	}

	function scoreLabel(value?: Score) {
		if (!value) return '–';
		if (value.mate !== undefined) return 'M' + Math.abs(value.mate);
		const pawns = value.cp / 100;
		return (pawns >= 0 ? '+' : '−') + Math.abs(pawns).toFixed(1);
	}

	function moveNumber(index: number) {
		const move = plies[index - 1];
		const number = move?.fenBefore.split(' ')[5];
		return move ? number + (move.color === 'w' ? '.' : '…') : '';
	}

	function select(ply: number) {
		if (ply < 0 || ply > plies.length) return;
		retryCheck?.abort();
		session = transition(session, { type: 'select', ply });
		status = '';
	}

	function navigate(direction: number) {
		if (session.kind === 'showingLine') {
			session = transition(session, { type: 'step', step: session.step + direction });
		} else if (session.kind !== 'retrying') {
			select(session.ply + direction);
		}
	}

	function handleKeys(event: KeyboardEvent) {
		if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
			|| (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]'))) return;
		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			navigate(event.key === 'ArrowLeft' ? -1 : 1);
		} else if (event.key === 'Escape' && started) {
			exitMode();
		}
	}

	function touchStart(event: TouchEvent) {
		const point = event.touches[0];
		touch = point && event.touches.length === 1 ? { x: point.clientX, y: point.clientY } : undefined;
	}

	function touchEnd(event: TouchEvent) {
		const point = event.changedTouches[0];
		if (!touch || !point) return;
		const dx = point.clientX - touch.x;
		const dy = point.clientY - touch.y;
		touch = undefined;
		if (Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy) * 1.4) navigate(dx < 0 ? 1 : -1);
	}

	function showLine() {
		if (!current) return;
		const line = lineMoves(current.fenBefore, current.best.pv);
		session = transition(session, { type: 'line', line });
	}

	function exitMode() {
		retryCheck?.abort();
		session = transition(session, { type: 'return' });
	}

	function startRetry(index = 0) {
		const task = retryable[index];
		if (!task) return;
		session = transition(session, { type: 'retry', ply: task.ply, index, total: retryable.length });
		orientation = retrySide;
		tab = 'moves';
		status = '';
	}

	function boardMove(value: string) {
		if (session.kind !== 'retrying' || session.attempt.kind !== 'playing') return;
		if (value.length === 5) {
			session = transition(session, { type: 'attempt', attempt: { kind: 'promoting', squares: value.slice(0, 4) } });
		} else {
			void playRetry(value);
		}
	}

	async function playRetry(value: string) {
		if (session.kind !== 'retrying' || !current) return;
		const uci = value as Uci;
		const move = current;
		const check = new AbortController();
		retryCheck = check;
		session = transition(session, { type: 'attempt', attempt: { kind: 'checking' } });
		try {
			const accepted = await retryMove(move, uci, check.signal);
			if (check.signal.aborted) return;
			const attempt = accepted ? { kind: 'solved', move: lineMoves(move.fenBefore, [uci])[0] } as const
				: { kind: 'playing', message: 'Try another move.' } as const;
			session = transition(session, { type: 'attempt', attempt });
		} catch {
			if (!check.signal.aborted) session = transition(session, { type: 'attempt', attempt: { kind: 'playing', message: 'Could not check that move. Try again.' } });
		}
	}

	function nextRetry() {
		if (session.kind !== 'retrying') return;
		if (session.index + 1 < session.total) startRetry(session.index + 1);
		else {
			exitMode();
			status = 'Retry complete. You found a better move for each position.';
		}
	}
</script>

<svelte:head><title>Game review · Chessmode</title></svelte:head>
<svelte:window onkeydown={handleKeys} />

{#snippet playerCard(side: Color)}
	{@const player = side === 'w' ? game?.white : game?.black}
	<div class="player">
		<span aria-hidden="true" class:white={side === 'w'} class="side"></span>
		<b title={player?.name}>{player?.name}</b>
		{#if player?.rating}<span>{player.rating}</span>{/if}
		{#if review}<span class="chip">{(side === 'w' ? review.white : review.black).accuracy.toFixed(1)}%</span>{/if}
	</div>
{/snippet}

{#snippet moveButton(index: number | undefined)}
	{#if index !== undefined}
		{@const analysed = reviewed[index - 1]}
		<button type="button" class="move" class:active={session.ply === index} aria-current={session.ply === index ? 'step' : undefined} onclick={() => select(index)}>
			<span>{plies[index - 1].san}</span>
			{#if analysed}<Label classification={analysed.classification} />{/if}
		</button>
	{:else}<span></span>{/if}
{/snippet}

<main class="page review">
	<header class="header">
		<a class="back" href="/matches" aria-label="Back to Matches">‹</a>
		<div>
			<h1>Game review</h1>
			{#if game}<p>{[review?.opening?.name ?? progress?.opening?.name ?? game.opening?.name, game.speed, game.result].filter(Boolean).join(' · ')}</p>{/if}
		</div>
		{#if game}
			<label class="depth">
				<span>Depth</span>
				<select aria-label="Analysis depth" value={depth} onchange={event => void changeDepth(event.currentTarget.value)} disabled={session.kind === 'retrying' || session.kind === 'showingLine'}>
					{#each DEPTHS as option}<option value={option.value}>{option.label} · {option.value}</option>{/each}
				</select>
			</label>
		{/if}
	</header>

	{#if game}
		<div class="workspace">
			<section class="board-column" aria-label="Game board">
				{@render playerCard(other(orientation))}
				<!-- Keep swipe capture on the wrapper since Chessground handles its own touch events. -->
				<div class="board-row" role="group" aria-label="Board position" ontouchstartcapture={touchStart} ontouchendcapture={touchEnd} ontouchcancel={() => { touch = undefined; }}>
					<div class="eval" class:inverted={orientation === 'b'} role="img" aria-label={'Evaluation ' + scoreLabel(score)}>
						<div class="fill" style:transform="scaleY({win / 100})"></div>
						<span>{scoreLabel(score)}</span>
					</div>
					<Board {fen} orientation={orientation === 'w' ? 'white' : 'black'} {lastMove} {arrows} {marker}
						movable={session.kind === 'retrying' && session.attempt.kind === 'playing' ? retrySide : 'none'} onmove={boardMove} />
				</div>
				{@render playerCard(orientation)}
			</section>

			<section class="panel" aria-label="Review controls">
				{#if session.kind === 'analysing'}
					<div class="card progress-card" role="status">
						<div><b>Analysing game</b><span>{progress?.ply ?? 0} / {plies.length} plies</span></div>
						<div class="progress" role="progressbar" aria-label="Game analysis progress" aria-valuenow={progress?.ply ?? 0} aria-valuemin={0} aria-valuemax={plies.length}>
							<i style:width={(progress?.ply ?? 0) / Math.max(1, plies.length) * 100 + '%'}></i>
						</div>
					</div>
				{/if}
				{#if error}
					<div class="card error" role="alert"><p>{error}</p><button class="btn btn-surface compact" onclick={() => void runAnalysis()}>Try analysis again</button></div>
				{/if}

				{#if session.kind === 'retrying'}
					<div class="card coach" role="status">
						<div class="coach-copy"><span class="eyeline">Retry {session.index + 1} of {session.total} · {retrySide === 'w' ? 'White' : 'Black'} to move</span>
							<h2>{session.attempt.kind === 'solved' ? session.attempt.move.san + ' works.' : 'Find a better move'}</h2>
							{#if session.attempt.kind === 'checking'}<p>Checking your move…</p>
							{:else if session.attempt.kind === 'playing' && session.attempt.message}<p>{session.attempt.message}</p>{/if}
						</div>
						{#if session.attempt.kind === 'promoting'}
							{@const fromTo = session.attempt.squares}
							<div class="actions" role="group" aria-label="Promote pawn">
								{#each promotions as { piece, key }}
									<button class="btn btn-surface compact" onclick={() => void playRetry(fromTo + key)}>{piece}</button>
								{/each}
							</div>
						{/if}
						<div class="actions">
							{#if session.attempt.kind === 'solved'}<button class="btn btn-primary compact" onclick={nextRetry}>{session.index + 1 === session.total ? 'Finish retry' : 'Next mistake'}</button>{/if}
							<button class="btn btn-surface compact" onclick={exitMode}>Back to game</button>
						</div>
					</div>
				{:else if session.kind === 'showingLine'}
					<div class="card coach">
						<div class="coach-copy"><span class="eyeline">Best line · {session.step} / {session.line.length} plies</span>
							<h2>{variation?.san ?? current?.best.san}</h2>
						</div>
						<div class="variation" aria-label="Best line moves">
							{#each session.line as move, index}
								<button class:active={session.step === index + 1} onclick={() => { session = transition(session, { type: 'step', step: index + 1 }); }}>{move.san}</button>
							{/each}
						</div>
						<div class="actions">
							<button class="btn btn-surface compact" disabled={session.step === 0} onclick={() => navigate(-1)}>Previous</button>
							<button class="btn btn-primary compact" disabled={session.step === session.line.length} onclick={() => navigate(1)}>Next line move</button>
							<button class="btn btn-ghost compact" onclick={exitMode}>Back to game</button>
						</div>
					</div>
				{:else}
					<div class="card coach">
						<div class="coach-main">
							{#if current}<Label classification={current.classification} />{/if}
							<div class="coach-copy">
								<span class="eyeline">{position ? moveNumber(session.ply) + position.san : 'Starting position'}</span>
								<h2>{current?.explanation.headline ?? (position ? (session.kind === 'analysing' ? 'Waiting for analysis…' : 'Analysis unavailable') : 'Select a move to review')}</h2>
								{#if current?.explanation.detail}<p>{current.explanation.detail}</p>{/if}
							</div>
						</div>
						{#if current || retryable.length}
							<div class="actions">
								{#if current}<button class="btn btn-surface compact" disabled={session.kind === 'analysing'} onclick={showLine}>Show best line</button>{/if}
								{#if retryable.length}<button class="btn btn-primary compact" onclick={() => startRetry()}>Retry mistakes</button>{/if}
							</div>
						{/if}
					</div>
					<div class="navigation" aria-label="Move navigation">
						<button class="btn btn-surface" aria-label="First position" title="First position" disabled={!session.ply} onclick={() => select(0)}>‹‹</button>
						<button class="btn btn-surface" aria-label="Previous move" title="Previous move" disabled={!session.ply} onclick={() => navigate(-1)}>‹</button>
						<button class="btn btn-surface" aria-label="Next move" title="Next move" disabled={session.ply === plies.length} onclick={() => navigate(1)}>›</button>
						<button class="btn btn-surface" aria-label="Last move" title="Last move" disabled={session.ply === plies.length} onclick={() => select(plies.length)}>››</button>
						<button class="btn btn-surface flip" onclick={() => { orientation = other(orientation); }}>Flip</button>
					</div>
				{/if}
				{#if status}<p role="status" class="status">{status}</p>{/if}

				{#if !started}
					<EvalGraph win={progress?.win ?? []} moves={reviewed} total={plies.length} ply={session.ply} onselect={select} />
					{#if deviation}
						<section class="card repertoire" aria-label="Repertoire">
							<span class="eyeline">{deviation.course.name}</span>
							{#if deviation.kind === 'you'}
								<p><b>You left your repertoire at {moveNumber(deviation.ply + 1)}</b> You played <span class="san">{deviation.played.san}</span>, the course plays <span class="san">{deviation.expected.san}</span>.</p>
							{:else if deviation.kind === 'opponent'}
								<p><b>Your opponent left the course at {moveNumber(deviation.ply + 1)}</b> <span class="san">{deviation.played.san}</span> is not prepared in the course, so you were on your own from here.</p>
							{:else}
								<p><b>You played the course to the end of the line</b> Every move up to {moveNumber(deviation.ply + 1)} was from your repertoire.</p>
							{/if}
							<div class="repertoire-actions">
								<button class="btn sm btn-surface" onclick={() => select(deviation.kind === 'complete' ? deviation.ply + 1 : deviation.ply)}>Show position</button>
								<a class="btn sm btn-primary" href={deviationHref}>{deviationLearned ? 'Drill this line' : 'Learn this line'}</a>
							</div>
						</section>
					{/if}
					<div class="seg" use:seg role="group" aria-label="Review panel">
						<button aria-pressed={tab === 'moves'} onclick={() => { tab = 'moves'; }}>Moves</button>
						<button aria-pressed={tab === 'summary'} onclick={() => { tab = 'summary'; }}>Summary</button>
					</div>
					{#if tab === 'summary'}
						{#if review}
							<Summary {game} {review} />
							{#if !game.userColor}
								<label class="card retry-side">Retry mistakes as
									<select aria-label="Side to retry" bind:value={retrySide}><option value="w">White</option><option value="b">Black</option></select>
								</label>
							{/if}
						{:else}<p class="card empty">The summary appears when analysis finishes.</p>{/if}
					{:else}
						<div class="card moves" aria-label="Move list" bind:this={moveList}>
							{#each rows as row (row.number)}
								<div class="move-row"><span>{row.number}</span>{@render moveButton(row.white)}{@render moveButton(row.black)}</div>
							{/each}
						</div>
						{#if keyMoments.length}
							<section class="card moments" aria-label="Key moments">
								<h2>Key moments</h2>
								<div>
									{#each keyMoments as move (move.ply)}
										<button class:active={session.ply === move.ply} onclick={() => select(move.ply)}>
											<span>{moveNumber(move.ply)} {move.san}</span><Label classification={move.classification} named />
										</button>
									{/each}
								</div>
							</section>
						{/if}
					{/if}
				{/if}
			</section>
		</div>
	{:else if error}
		<p role="alert" class="card error">{error}</p>
	{:else}
		<p role="status" class="card empty">Loading game…</p>
	{/if}
</main>

<style>
	.review { max-width: 580px; padding-top: 12px; padding-bottom: 28px; }
	.header { display: flex; align-items: center; gap: 10px; margin-bottom: 13px; }
	.header > div { flex: 1; min-width: 0; }
	h1 { font-size: 24px; line-height: 1.12; letter-spacing: -.045em; }
	.header p { margin-top: 3px; color: var(--text-2); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.back { display: grid; place-items: center; width: 35px; height: 35px; flex: 0 0 auto; border: 1px solid var(--stroke-2); border-radius: var(--r-sm); background: var(--surface-2); font: 32px/1 var(--font); padding-bottom: 3px; }
	.depth { display: grid; gap: 2px; flex-shrink: 0; }
	.depth span { color: var(--text-2); font-size: 10px; }
	select { max-width: 100%; border: 1px solid var(--stroke-2); border-radius: var(--r-xs); background: var(--surface-2); color: var(--text); font: 11px var(--mono); padding: 6px 4px; }
	.workspace, .panel { display: grid; gap: 10px; min-width: 0; align-content: start; }
	.board-column { display: grid; gap: 5px; min-width: 0; align-content: start; }
	.player { display: flex; align-items: center; min-width: 0; gap: 8px; min-height: 30px; padding: 0 1px; }
	.player b { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-size: 13px; }
	.player span { flex: 0 0 auto; color: var(--text-2); font: 11px var(--mono); }
	.player .chip { margin-left: auto; color: var(--text); }
	.side { width: 12px; aspect-ratio: 1; background: #2e2e31; border: 1px solid #4d4d52; border-radius: 3px; }
	.side.white { background: #e9e4dd; border-color: #f4f4f2; }
	.board-row { display: grid; grid-template-columns: 23px minmax(0, 1fr); gap: 6px; }
	.eval { position: relative; overflow: hidden; text-align: center; border: 1px solid var(--stroke-2); border-radius: var(--r-xs); background: #262629; color: var(--text); }
	.eval .fill { position: absolute; inset: 0; background: #e9e4dd; transform-origin: bottom; transition: transform 200ms var(--ease-out); }
	.eval.inverted { background: #e9e4dd; color: var(--bg); }
	.eval.inverted .fill { background: #262629; }
	.eval span { position: absolute; inset: 6px auto auto 50%; writing-mode: vertical-rl; transform: translateX(-50%) rotate(180deg); font: 700 10px var(--mono); mix-blend-mode: difference; color: white; }
	.coach, .progress-card, .error, .empty { padding: 12px 14px; }
	.coach { display: grid; gap: 10px; background: var(--g-card-glow), var(--surface-2); }
	.coach-main { display: flex; align-items: center; gap: 10px; }
	.eyeline { display: block; color: var(--text-2); font: 10px var(--mono); }
	.coach h2 { font-size: 16px; letter-spacing: -.025em; }
	.coach p, .empty { font-size: 13px; color: var(--text-2); }
	.actions { display: flex; flex-wrap: wrap; gap: 8px; }
	.compact { height: 34px; font-size: 12px; padding: 0 12px; }
	.navigation { display: grid; grid-template-columns: repeat(4, 1fr) minmax(49px, .8fr); gap: 7px; }
	.navigation .btn { height: 38px; padding: 0; border-radius: var(--r-sm); font-size: 19px; }
	.navigation .flip { font-size: 12px; }
	.variation { display: flex; flex-wrap: wrap; gap: 5px; }
	.variation button { padding: 4px 7px; border-radius: var(--r-xs); background: var(--surface-3); font: 12px var(--mono); }
	.active { background: var(--accent-soft) !important; color: var(--accent-hi); }
	.progress-card > div:first-child { display: flex; justify-content: space-between; align-items: baseline; gap: 9px; margin-bottom: 7px; }
	.progress-card span { color: var(--text-2); font: 11px var(--mono); }
	.error { color: var(--bad); }
	.error button { margin-top: 8px; }
	.status { color: var(--good); font-size: 13px; padding: 0 4px; }
	.moves { max-height: 260px; overflow-y: auto; overscroll-behavior: contain; padding: 6px; }
	.move-row { display: grid; grid-template-columns: 37px 1fr 1fr; gap: 3px; align-items: center; }
	.move-row:nth-child(even) { background: var(--surface-1); border-radius: var(--r-xs); }
	.move-row > span { text-align: center; color: var(--text-2); font: 11px var(--mono); }
	.move { display: flex; text-align: left; align-items: center; justify-content: space-between; min-height: 35px; padding: 3px 9px; gap: 5px; font: 13px var(--mono); border-radius: var(--r-xs); }
	@media (hover: hover) and (pointer: fine) { .move:hover, .moments button:hover { background: var(--surface-4); } }
	.repertoire { padding: 12px 14px; display: grid; gap: 8px; }
	.repertoire p { font-size: 14px; line-height: 1.5; color: var(--text-2); }
	.repertoire p b { display: block; color: var(--text); font-weight: 600; }
	.repertoire .san { font: 600 13px var(--mono); color: var(--accent-hi); }
	.repertoire-actions { display: flex; gap: 8px; flex-wrap: wrap; }
	.moments { padding: 10px 12px; }
	.moments h2 { font-size: 14px; margin-bottom: 6px; }
	.moments > div { display: grid; max-height: 220px; overflow-y: auto; }
	.moments button { display: flex; min-height: 35px; justify-content: space-between; align-items: center; padding: 3px 7px; border-radius: var(--r-xs); gap: 5px; font: 12px var(--mono); }
	.retry-side { display: flex; align-items: center; gap: 10px; padding: 9px 14px; font-size: 13px; }
	@media (min-width: 1024px) {
		.review { max-width: 1160px; }
		.header { margin-bottom: 18px; }
		h1 { font-size: 31px; }
		.header p { font-size: 13px; }
		.workspace { grid-template-columns: minmax(0, 1.3fr) minmax(340px, 1fr); gap: 23px; }
		.board-column { position: sticky; top: 8px; }
		.board-row { grid-template-columns: 27px minmax(0, 1fr); gap: 8px; }
		.panel { gap: 12px; padding-top: 35px; }
		.player b { font-size: 15px; }
		.coach h2 { font-size: 19px; }
		.coach, .progress-card { padding: 15px 16px; }
		.navigation .btn { height: 43px; }
	}
</style>
