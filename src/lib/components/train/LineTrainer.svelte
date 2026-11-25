<script lang="ts">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import { Chess } from 'chess.js';
	import Board, { type Arrow, type Marker } from '#lib/components/Board.svelte';
	import { START_FEN, type Uci } from '#lib/chess/types.ts';
	import type { Course, CoursePly, Line } from '#lib/courses/types.ts';
	import type { TrainerMode } from '#lib/train/types.ts';
	import { startLine, step } from '#lib/train/reducer.ts';
	import { isMuted, play, setMuted } from '#lib/sound.ts';

	interface Props {
		course: Course;
		line: Line;
		mode: TrainerMode;
		closeHref: string;
		/** Called once when the line is finished (or, in drill mode, failed). */
		onfinish: (result: { mistakes: number; hints: number }) => void;
		onmistake?: () => void;
		/** Replaces the progress bar in the top bar, e.g. a clock or a streak counter. */
		status?: Snippet;
		/** Extra content above the coach card, e.g. session progress. */
		heading?: Snippet;
	}

	let { course, line, mode, closeHref, onfinish, onmistake, status, heading }: Props = $props();

	let run = $state(untrack(() => startLine(line, mode)));
	let finished = false;
	let muted = $state(isMuted());
	let flash = $state<Marker | undefined>();
	let shake = $state(false);
	let wrongSan = $state<string | undefined>();
	let feedEl = $state<HTMLDivElement>();

	const index = $derived(run.state.kind === 'done' ? line.plies.length : run.state.index);
	const fen = $derived(index === 0 ? START_FEN : line.plies[index - 1].fenAfter);
	const current = $derived<CoursePly | undefined>(line.plies[index]);
	const last = $derived(index ? line.plies[index - 1] : undefined);
	const orientation = $derived(course.side === 'w' ? 'white' : 'black');
	const showNotes = $derived(mode === 'learn' || mode === 'practice');
	const revealed = $derived((run.state.kind === 'student' || run.state.kind === 'wrong') && run.state.revealed);
	const studentPlies = $derived(line.plies.filter((p) => p.student).length);
	const studentDone = $derived(line.plies.slice(0, index).filter((p) => p.student).length);

	const arrows = $derived.by((): Arrow[] =>
		revealed && current ? [{ from: current.uci.slice(0, 2), to: current.uci.slice(2, 4), brush: 'accent' }] : []
	);

	/** Notes for moves already on the board, newest last. In practice, notes appear only after a mistake or at the end. */
	const feed = $derived(
		line.plies
			.slice(0, index)
			.map((p, i) => ({ p, i }))
			.filter(({ p }) => p.note && (mode === 'learn' || run.state.kind === 'done' || run.mistakes > 0))
	);

	const moveLabel = (i: number) => {
		const n = Math.floor(i / 2) + 1;
		return line.plies[i].color === 'w' ? `${n}.` : `${n}...`;
	};

	function sanOf(uci: string): string {
		try {
			return new Chess(fen).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }).san;
		} catch {
			return uci;
		}
	}

	function cueFor(ply: CoursePly) {
		play(ply.san.includes('x') ? 'capture' : 'move');
	}

	$effect(() => {
		const s = run.state;
		if (s.kind === 'opponent') {
			const delay = s.index === 0 ? 650 : 450;
			const t = setTimeout(() => {
				cueFor(line.plies[s.index]);
				run = step(run, { type: 'opponentPlayed' });
			}, delay);
			return () => clearTimeout(t);
		}
		if (s.kind === 'done' && !finished) {
			finished = true;
			if (s.mistakes === 0 || mode !== 'drill') play('complete');
			onfinish({ mistakes: s.mistakes, hints: s.hints });
		}
	});

	$effect(() => {
		void feed.length;
		feedEl?.scrollTo({ top: feedEl.scrollHeight, behavior: 'smooth' });
	});

	function onmove(uci: string) {
		if (run.state.kind !== 'student' && run.state.kind !== 'wrong') return;
		const expected = current;
		if (run.state.kind === 'wrong') run = step(run, { type: 'retry' });
		const before = run.mistakes;
		const played = sanOf(uci);
		run = step(run, { type: 'studentMoved', uci: uci as Uci });
		if (run.mistakes > before) {
			wrongSan = played;
			shake = true;
			setTimeout(() => (shake = false), 420);
			play('wrong');
			onmistake?.();
			return;
		}
		wrongSan = undefined;
		if (expected) {
			cueFor(expected);
			if (mode !== 'learn') {
				flash = { square: expected.uci.slice(2, 4), glyph: '✓', color: 'var(--good)', label: 'Correct' };
				setTimeout(() => (flash = undefined), 700);
			}
		}
	}

	function hint() {
		if (run.state.kind === 'student' && !run.state.revealed) run = step(run, { type: 'hint' });
	}

	function onkey(e: KeyboardEvent) {
		if (e.key === 'h' && mode !== 'learn') hint();
	}

	async function toggleSound() {
		muted = !muted;
		await setMuted(muted);
	}
</script>

<svelte:window onkeydown={onkey} />

<div class="trainer">
	<header class="topbar">
		<a class="icon-btn" href={closeHref} aria-label="Close">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
		</a>
		<div class="status">
			{#if status}
				{@render status()}
			{:else}
				<div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={studentPlies} aria-valuenow={studentDone}>
					<i style:width="{(100 * studentDone) / Math.max(1, studentPlies)}%"></i>
				</div>
				<span class="count">{studentDone}/{studentPlies}</span>
			{/if}
		</div>
		<button class="icon-btn" onclick={toggleSound} aria-label={muted ? 'Turn sound on' : 'Turn sound off'} aria-pressed={!muted}>
			{#if muted}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4zM22 9l-6 6M16 9l6 6" /></svg>
			{:else}
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4zM15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /></svg>
			{/if}
		</button>
	</header>

	<div class="layout">
		<section class="board-col" class:shake>
			<Board
				{fen}
				{orientation}
				movable={run.state.kind === 'student' || run.state.kind === 'wrong' ? course.side : 'none'}
				lastMove={last ? [last.uci.slice(0, 2), last.uci.slice(2, 4)] : undefined}
				{arrows}
				marker={flash}
				{onmove}
			/>
		</section>

		<aside class="panel">
			{#if heading}{@render heading()}{/if}
			<div class="title">
				<p class="label">{course.name}</p>
				<h1 class="h-title">{line.name}</h1>
			</div>

			<div class="prompt card" class:wrong={run.state.kind === 'wrong'} aria-live="polite">
				{#if run.state.kind === 'opponent'}
					<span class="dot opp"></span>
					<p><b>{course.side === 'w' ? 'Black' : 'White'} to move</b></p>
				{:else if run.state.kind === 'student' && current}
					<span class="dot you"></span>
					<p>
						<b>Your move.</b>
						{#if revealed}
							Play <span class="san">{moveLabel(index)}{current.san}</span>{mode === 'learn' ? ', follow the arrow.' : '.'}
						{:else}
							What does your repertoire play here?
						{/if}
					</p>
				{:else if run.state.kind === 'wrong' && current}
					<span class="dot bad"></span>
					<p><b>{wrongSan ?? 'That'} is not the line.</b> Play <span class="san">{moveLabel(index)}{current.san}</span>.</p>
				{:else if run.state.kind === 'done'}
					<span class="dot good"></span>
					<p><b>{run.mistakes === 0 ? 'Line complete.' : `Line complete, ${run.mistakes} ${run.mistakes === 1 ? 'mistake' : 'mistakes'}.`}</b></p>
				{/if}
			</div>

			{#if showNotes}
				<div class="feed" bind:this={feedEl}>
					{#each feed as { p, i } (i)}
						<article class="note" class:latest={i === feed[feed.length - 1]?.i} class:mine={p.student}>
							<span class="san">{moveLabel(i)}{p.san}</span>
							<p>{p.note}</p>
						</article>
					{:else}
						{#if mode === 'learn'}
							<p class="empty">Notes on each move appear here as the line is played.</p>
						{/if}
					{/each}
				</div>
			{/if}

			<div class="moves" aria-label="Moves">
				{#each line.plies.slice(0, index + 1) as ply, i (i)}
					<span class:played={i < index} class:current={i === index} class:mine={ply.student}>
						{#if ply.color === 'w' || i === 0}<em>{moveLabel(i)}</em>{/if}{i < index || (revealed && i === index) ? ply.san : '?'}
					</span>
				{/each}
			</div>

			{#if mode !== 'learn' && run.state.kind === 'student' && !run.state.revealed}
				<button class="btn btn-surface block hint" onclick={hint}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" /></svg>
					Hint
				</button>
			{/if}
		</aside>
	</div>
</div>

<style>
	.trainer {
		max-width: 1120px;
		margin: 0 auto;
		padding: 12px var(--gutter) calc(32px + var(--safe-bottom));
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 4px 0 14px;
	}
	.status {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}
	.status .progress {
		flex: 1;
	}
	.count {
		font: 600 13px var(--mono);
		color: var(--text-2);
	}
	.layout {
		display: grid;
		gap: 16px;
	}
	.board-col {
		width: 100%;
		max-width: 560px;
		margin: 0 auto;
	}
	.panel {
		display: grid;
		gap: 12px;
		align-content: start;
		min-width: 0;
	}
	.title .h-title {
		margin-top: 2px;
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
	.prompt.wrong {
		border-color: rgba(255, 90, 82, 0.4);
		background: linear-gradient(180deg, rgba(255, 90, 82, 0.1), rgba(255, 90, 82, 0.03)), var(--surface-2);
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
		animation: pulse 1.4s var(--ease-out) infinite;
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
	@keyframes pulse {
		50% {
			box-shadow: 0 0 0 7px rgba(255, 107, 44, 0.05);
		}
	}
	.san {
		font: 600 14px var(--mono);
		color: var(--accent-hi);
		white-space: nowrap;
	}
	.feed {
		display: grid;
		gap: 8px;
		max-height: 230px;
		overflow-y: auto;
		scrollbar-width: thin;
		padding-right: 2px;
	}
	.note {
		padding: 12px 14px;
		border-radius: var(--r-md);
		background: var(--surface-1);
		border: 1px solid var(--stroke);
		opacity: 0.6;
		transition: opacity 0.3s;
	}
	.note.latest {
		opacity: 1;
		background: var(--surface-2);
		border-color: var(--stroke-2);
		animation: rise 0.3s var(--ease-out);
	}
	.note .san {
		display: inline-block;
		margin-bottom: 4px;
	}
	.note:not(.mine) .san {
		color: var(--text-2);
	}
	.note p {
		font-size: 14px;
		line-height: 1.5;
		color: var(--text);
	}
	.empty {
		font-size: 13px;
		color: var(--text-3);
	}
	@keyframes rise {
		from {
			transform: translateY(6px);
			opacity: 0;
		}
	}
	.moves {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 6px;
		font: 13px/1.9 var(--mono);
		color: var(--text-3);
	}
	.moves span {
		padding: 0 6px;
		border-radius: 6px;
	}
	.moves em {
		font-style: normal;
		margin-right: 3px;
		color: var(--text-3);
	}
	.moves .played {
		color: var(--text-2);
	}
	.moves .played.mine {
		color: var(--text);
	}
	.moves .current {
		background: var(--surface-3);
		color: var(--text);
		box-shadow: inset 0 -2px 0 var(--accent);
	}
	.hint {
		margin-top: 4px;
	}
	.shake {
		animation: shake 0.4s var(--ease-out);
	}
	@keyframes shake {
		20%,
		60% {
			transform: translateX(-6px);
		}
		40%,
		80% {
			transform: translateX(6px);
		}
	}
	@media (min-width: 960px) {
		.trainer {
			padding-top: 20px;
		}
		.layout {
			grid-template-columns: minmax(0, 600px) minmax(320px, 400px);
			justify-content: center;
			gap: 28px;
			align-items: start;
		}
		.board-col {
			max-width: none;
		}
		.feed {
			max-height: 340px;
		}
		.panel {
			position: sticky;
			top: 20px;
		}
	}
</style>
