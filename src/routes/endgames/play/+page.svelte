<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import ResultSheet from '#lib/components/train/ResultSheet.svelte';
	import Table from '#lib/endgames/Table.svelte';
	import type { Fen, Uci } from '#lib/chess/types.ts';
	import { getEngine } from '#lib/engine/stockfish.ts';
	import { hint, keepTrying, opponentMove, playerMove, playAnyway, resign, resultLabel, showMove, startEndgame, type EndgamePlay } from '#lib/endgames/play.ts';
	import { coachingFor, recordEndgame, resultScore, targetRating } from '#lib/endgames/progress.ts';
	import { loadEndgames, pickPosition } from '#lib/endgames/select.ts';
	import { loadEndgameProgress, saveEndgameProgress } from '#lib/endgames/store.ts';
	import type { EndgamePosition, EndgameProgress } from '#lib/endgames/types.ts';
	import { elo } from '#lib/ratings.ts';
	import type { Score } from '#lib/review/types.ts';
	import { DEFAULT_PREFERENCES, type Preferences } from '#lib/settings/types.ts';
	import { play } from '#lib/sound.ts';

	let progress = $state<EndgameProgress | undefined>();
	let pool = $state<EndgamePosition[]>([]);
	let position = $state<EndgamePosition | undefined>();
	let round = $state<EndgamePlay | undefined>();
	let recommended = $state<Uci | undefined>();
	let preferences = $state<Preferences>({ ...DEFAULT_PREFERENCES });
	let score = $state<Score | undefined>();
	let busy = $state(false);
	let error = $state('');
	let settings = $state(false);
	let summary = $state<{ before: number; after: number; title: string } | undefined>();
	let sessionCount = 0;
	let search: AbortController | undefined;
	let saved = false;

	const arrows = $derived.by(() => {
		if (!round) return [];
		if (round.coach === 'hint' && round.hintFrom) return [{ from: round.hintFrom, brush: 'accent' as const }];
		if (round.coach === 'shown' && round.showUci) {
			return [{ from: round.showUci.slice(0, 2), to: round.showUci.slice(2, 4), brush: 'accent' as const }];
		}
		return [];
	});

	function cue(san: string) {
		if (san.includes('#')) play('complete');
		else if (san.includes('+')) play('check');
		else if (san.includes('x')) play('capture');
		else play('move');
	}

	function stopSearch() {
		search?.abort();
		search = undefined;
		busy = false;
	}

	async function advise(current: EndgamePlay) {
		if (current.coach === 'off') {
			recommended = current.fen === position?.fen ? position.idea : undefined;
			return;
		}
		recommended = current.plies.length === 0 ? position?.idea : undefined;
		stopSearch();
		const ctrl = new AbortController();
		search = ctrl;
		busy = true;
		try {
			const analysis = await getEngine().analyse(current.fen, { depth: 8, movetime: 500, signal: ctrl.signal });
			if (search !== ctrl || round?.session !== current.session || round.fen !== current.fen) return;
			score = analysis.lines[0]?.score;
			recommended = analysis.lines[0]?.pv[0] ?? recommended;
		} catch (reason) {
			if (search === ctrl) error = reason instanceof Error && reason.name === 'AbortError' ? '' : 'The hint search stopped. You can still move.';
		} finally {
			if (search === ctrl) busy = false;
		}
	}

	async function reply(current: EndgamePlay) {
		stopSearch();
		const ctrl = new AbortController();
		search = ctrl;
		busy = true;
		error = '';
		const depth = current.coach === 'off' ? 12 : 6;
		try {
			const analysis = await getEngine().analyse(current.fen, { depth, movetime: depth === 12 ? 700 : 400, signal: ctrl.signal });
			if (search !== ctrl || round?.session !== current.session || round.phase !== 'opponent') return;
			score = analysis.lines[0]?.score;
			const uci = analysis.lines[0]?.pv[0];
			if (!uci) {
				error = 'No reply came back. Resign, or start the next position.';
				return;
			}
			const next = opponentMove(current, current.session, uci);
			if (next === current) return;
			cue(next.plies.at(-1)?.san ?? '');
			adopt(next);
		} catch (reason) {
			if (search === ctrl && !(reason instanceof Error && reason.name === 'AbortError')) error = 'The engine stopped. Start the next position.';
		} finally {
			if (search === ctrl) busy = false;
		}
	}

	function adopt(next: EndgamePlay) {
		round = next;
		if (next.phase === 'over') {
			void settle(next);
			return;
		}
		if (next.phase === 'opponent') void reply(next);
		else if (next.phase === 'player') void advise(next);
	}

	async function settle(done: EndgamePlay) {
		if (saved || !progress || !position || !done.result || !done.termination) return;
		saved = true;
		const before = progress.rating;
		const after = elo(before, position.rating, resultScore(done.result, done.helped));
		progress = recordEndgame(progress, after, done.result, position.id);
		await saveEndgameProgress(progress);
		summary = { before, after, title: resultLabel(done.result, done.termination) };
		play(done.result === 'win' ? 'complete' : 'wrong');
	}

	function deal(nextProgress: EndgameProgress) {
		const coaching = coachingFor(nextProgress);
		const picked = pickPosition(pool, targetRating(coaching.progress), coaching.progress.seen);
		if (!picked) {
			error = 'No endgame positions are loaded.';
			return;
		}
		saved = false;
		summary = undefined;
		error = '';
		score = undefined;
		position = picked;
		progress = coaching.progress;
		sessionCount += 1;
		const started = startEndgame(picked, `e${sessionCount}`, coaching.coached);
		round = started;
		void saveEndgameProgress(coaching.progress);
		void advise(started);
	}

	function onmove(uci: string) {
		if (!round || busy && round.phase === 'opponent') return;
		const next = playerMove(round, round.session, uci, round.coach === 'off' ? undefined : recommended);
		if (next === round) return;
		if (next.phase === 'considering') play('wrong');
		else cue(next.plies.at(-1)?.san ?? '');
		adopt(next);
	}

	function nextPosition() {
		if (!progress) return;
		stopSearch();
		deal(progress);
	}

	onMount(async () => {
		const [loaded, positions] = await Promise.all([loadEndgameProgress(), loadEndgames()]);
		pool = positions;
		progress = loaded;
		deal(loaded);
	});

	onDestroy(stopSearch);
</script>

<svelte:head><title>Endgame · Chessmode</title></svelte:head>

{#if round && position}
	<Table
		{round}
		{position}
		rating={progress?.rating ?? 0}
		{preferences}
		{score}
		{busy}
		{error}
		{settings}
		{arrows}
		{onmove}
		onhint={() => round && (round = hint(round, recommended ?? position?.idea))}
		onshow={() => round && (round = showMove(round, recommended ?? position?.idea))}
		onkeep={() => round && (round = keepTrying(round))}
		oncommit={() => round && adopt(playAnyway(round))}
		onresign={() => round && adopt(resign(round))}
		ontogglesettings={() => (settings = !settings)}
		onpreferences={(next) => (preferences = next)}
	/>
{:else}
	<main class="page"><p class="muted">{error || 'Loading an endgame…'}</p></main>
{/if}

{#if summary && round?.phase === 'over'}
	<ResultSheet expression={round.result === 'win' ? 'celebrating' : round.result === 'draw' ? 'thinking' : 'encouraging'} eyebrow="Endgame" title={summary.title} subtitle={`${summary.before} → ${summary.after}`}>
		{#snippet actions()}
			<button class="btn btn-primary block" type="button" onclick={nextPosition}>Next position</button>
			<a class="btn btn-surface block" href="/endgames">Done</a>
		{/snippet}
	</ResultSheet>
{/if}

