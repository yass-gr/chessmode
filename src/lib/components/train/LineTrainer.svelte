<script lang="ts">
	import type { Snippet } from 'svelte';
	import { onMount, untrack } from 'svelte';
	import { Chess } from 'chess.js';
	import Board, { type Arrow, type Marker } from '#lib/components/Board.svelte';
	import Mascot, { type MascotExpression } from '#lib/components/Mascot.svelte';
	import Sheet from '#lib/components/Sheet.svelte';
	import SettingsPanel from '#lib/components/settings/SettingsPanel.svelte';
	import ResetCourse from '#lib/components/train/ResetCourse.svelte';
	import EvalBar from '#lib/components/review/EvalBar.svelte';
	import { START_FEN, type Fen, type Uci } from '#lib/chess/types.ts';
	import { judgeWrongMove, type WrongMoveVerdict } from '#lib/chess/explain.ts';
	import type { Course, CoursePly, Line } from '#lib/courses/types.ts';
	import { getEngine } from '#lib/engine/stockfish.ts';
	import { reducedMotion } from '#lib/motion.ts';
	import type { Score } from '#lib/review/types.ts';
	import { opponentDelay, readCoursePreferences, readPreferences, showEvaluation } from '#lib/settings/preferences.ts';
	import { DEFAULT_COURSE_PREFERENCES, DEFAULT_PREFERENCES, type CoursePreferences, type Preferences } from '#lib/settings/types.ts';
	import { isMuted, play, setMuted } from '#lib/sound.ts';
	import { arrowFor, coachOpen } from '#lib/train/coach.ts';
	import { matchingLine } from '#lib/train/lines.ts';
	import { startLine, step } from '#lib/train/reducer.ts';
	import { TIME_MODE } from '#lib/train/session.ts';
	import type { AttemptResult, TrainerMode } from '#lib/train/types.ts';

	interface Props {
		course: Course;
		line: Line;
		mode: TrainerMode;
		closeHref: string;
		startAt?: number;
		sharedStartAvailable?: boolean;
		returnHref?: string;
		returnLabel?: string;
		onfinish: (result: AttemptResult) => void;
		onmistake?: () => void;
		onhint?: () => void;
		onprogress?: (result: AttemptResult) => void;
		onleave?: () => void;
		onreset?: () => void;
		status?: Snippet;
		heading?: Snippet;
	}

	let {
		course,
		line,
		mode,
		closeHref,
		startAt = 0,
		sharedStartAvailable = false,
		returnHref,
		returnLabel = 'Return to the lesson',
		onfinish,
		onmistake,
		onhint,
		onprogress,
		onleave,
		onreset,
		status,
		heading
	}: Props = $props();

	let run = $state(untrack(() => startLine(line, mode, startAt)));
	let reported = false;
	let preferences = $state<Preferences>({ ...DEFAULT_PREFERENCES });
	let coursePreferences = $state<CoursePreferences>({ ...DEFAULT_COURSE_PREFERENCES });
	let prefsReady = $state(false);
	let asked = $state(false);
	let muted = $state(isMuted());
	let flash = $state<Marker | undefined>();
	let shake = $state(false);
	let wrong = $state<{ san: string; fen: Fen; uci: Uci; verdict: WrongMoveVerdict } | undefined>();
	let feedEl = $state<HTMLDivElement>();
	let settingsOpen = $state(false);
	let leaving = $state(false);
	let premoveEpoch = $state(0);
	let evaluation = $state<Score | undefined>();

	const liveIndex = $derived(run.state.kind === 'done' ? line.plies.length : run.state.index);
	const shownIndex = $derived(run.view ?? liveIndex);
	const lineFen = $derived(shownIndex === 0 ? START_FEN : line.plies[shownIndex - 1].fenAfter);
	const fen = $derived(run.view === null && run.state.kind === 'wrong' && wrong ? wrong.fen : lineFen);
	const current = $derived<CoursePly | undefined>(line.plies[liveIndex]);
	const shownPly = $derived(shownIndex ? line.plies[shownIndex - 1] : undefined);
	const orientation = $derived(course.side === 'w' ? 'white' : 'black');
	const hint = $derived(run.state.kind === 'student' || run.state.kind === 'wrong' || run.state.kind === 'fix' ? run.state.hint : 'none');
	const explanatory = $derived(run.state.kind === 'wrong' || run.state.kind === 'done' || hint !== 'none' || run.mistakes > 0);
	const open = $derived(coachOpen({ mode, coaching: preferences.coaching, requested: asked, explanatory }));
	const hideAnswer = $derived(run.state.kind === 'fix' && run.state.index === run.state.resume && hint !== 'move');
	const forcedArrow = $derived(mode === 'time' && hint === 'move' && run.mistakes > 0);
	const arrowKind = $derived(
		run.view !== null ? 'none' : arrowFor({ setting: preferences.arrows, hint, coachOpen: open, hideAnswer, forced: forcedArrow })
	);
	const playing = $derived(
		run.view === null &&
			(run.state.kind === 'student' || (run.state.kind === 'fix' && !!line.plies[run.state.index]?.student))
	);
	const waiting = $derived(
		run.view === null &&
			(run.state.kind === 'opponent' || (run.state.kind === 'fix' && !line.plies[run.state.index]?.student && run.state.kind === 'fix'))
	);
	const movable = $derived(playing || waiting ? course.side : 'none');
	const active = $derived(
		run.state.kind !== 'done' && (mode === 'drill' || mode === 'time' || run.state.kind === 'wrong' || run.state.kind === 'fix' || liveIndex > run.origin)
	);
	const showEval = $derived(showEvaluation(mode, preferences));
	const studentPlies = $derived(line.plies.filter((ply) => ply.student).length);
	const studentDone = $derived(line.plies.slice(0, liveIndex).filter((ply) => ply.student).length);
	const opponentName = $derived(course.side === 'w' ? 'Black' : 'White');
	const finalNote = $derived(line.plies[line.plies.length - 1]?.note);
	const clean = $derived(run.mistakes === 0 && run.hints === 0);
	const lessonExpression = $derived.by((): MascotExpression => {
		if (run.view !== null) return 'thinking';
		if (run.state.kind === 'wrong' || run.state.kind === 'fix') return 'encouraging';
		if (run.state.kind === 'done') return 'celebrating';
		if (run.state.kind === 'opponent' && shownPly?.student) return 'happy';
		return 'neutral';
	});

	const arrows = $derived.by((): Arrow[] => {
		if (!current || arrowKind === 'none') return [];
		const from = current.uci.slice(0, 2);
		if (arrowKind === 'source') return [{ from, brush: 'accent' }];
		return [{ from, to: current.uci.slice(2, 4), brush: 'accent' }];
	});
	const marker = $derived<Marker | undefined>(
		run.view === null && run.state.kind === 'wrong' && wrong
			? { square: wrong.uci.slice(2, 4), glyph: '?', color: 'var(--bad)', label: 'Not the line' }
			: flash
	);
	const lastMove = $derived.by((): [string, string] | undefined => {
		if (run.view === null && run.state.kind === 'wrong' && wrong) return [wrong.uci.slice(0, 2), wrong.uci.slice(2, 4)];
		return shownPly ? [shownPly.uci.slice(0, 2), shownPly.uci.slice(2, 4)] : undefined;
	});
	const feed = $derived.by(() => {
		if (!open) return [];
		return line.plies
			.slice(0, shownIndex)
			.map((ply, index) => ({ ply, index }))
			.filter(({ ply }) => preferences.coaching === 'always' || !!ply.note);
	});
	const alternate = $derived.by(() => {
		if (run.view !== null || run.state.kind !== 'wrong' || !wrong) return;
		const found = matchingLine(course, wrong.fen, line.key);
		if (!found) return;
		const back = returnHref ?? `/learn/${course.id}/${line.id}`;
		return { name: found.line.name, href: `/learn/${course.id}/${found.line.id}?return=${encodeURIComponent(back)}` };
	});

	const moveLabel = (i: number) => {
		const n = Math.floor(i / 2) + 1;
		return line.plies[i].color === 'w' ? `${n}.` : `${n}...`;
	};

	function sanOf(uci: string, from: Fen): string {
		try {
			return new Chess(from).move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined }).san;
		} catch {
			return uci;
		}
	}

	function cueFor(ply: CoursePly) {
		play(ply.san.includes('x') ? 'capture' : 'move');
	}

	function buzz(ms: number) {
		if (!preferences.haptics || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
		navigator.vibrate(ms);
	}

	function publish() {
		onprogress?.({ mistakes: run.mistakes, hints: run.hints, points: run.points });
	}

	onMount(() => {
		let current = true;
		void Promise.all([readPreferences(), readCoursePreferences(course.id)]).then(([prefs, coursePrefs]) => {
			if (!current) return;
			preferences = prefs;
			coursePreferences = coursePrefs;
			muted = !prefs.sound;
			prefsReady = true;
		});
		return () => {
			current = false;
		};
	});

	$effect(() => {
		const mark = `${run.state.kind}:${'index' in run.state ? run.state.index : ''}`;
		void mark;
		asked = false;
	});

	$effect(() => {
		if (!showEval) {
			evaluation = undefined;
			return;
		}
		const current = fen;
		const ctrl = new AbortController();
		void getEngine()
			.analyse(current as Fen, { depth: 8, signal: ctrl.signal }, (update) => {
				if (ctrl.signal.aborted || update.fen !== current) return;
				evaluation = update.lines[0]?.score;
			})
			.catch(() => {});
		return () => ctrl.abort();
	});

	$effect(() => {
		if (!prefsReady || run.view !== null) return;
		const s = run.state;
		let current = true;
		if (s.kind === 'done') {
			const result = { mistakes: run.mistakes, hints: run.hints, points: run.points };
			queueMicrotask(() => {
				if (!current || reported) return;
				reported = true;
				if (clean && preferences.confetti) play('complete');
				else if (mode !== 'drill' || clean) play('complete');
				onfinish(result);
			});
			return () => {
				current = false;
			};
		}
		const auto = s.kind === 'opponent' || (s.kind === 'fix' && !line.plies[s.index]?.student);
		if (!auto) return;
		const delay = opponentDelay(mode, coursePreferences);
		const timer = setTimeout(() => {
			if (!current) return;
			const ply = line.plies[s.index];
			if (ply) cueFor(ply);
			run = step(run, { type: 'opponentPlayed' });
		}, delay);
		return () => {
			current = false;
			clearTimeout(timer);
		};
	});

	$effect(() => {
		if (!prefsReady || mode !== 'time' || run.view !== null || run.state.kind !== 'wrong') return;
		let current = true;
		const timer = setTimeout(() => {
			if (!current) return;
			run = step(step(run, { type: 'reveal' }), { type: 'retry' });
			wrong = undefined;
		}, TIME_MODE.rollbackMs);
		return () => {
			current = false;
			clearTimeout(timer);
		};
	});

	$effect(() => {
		void feed.length;
		feedEl?.scrollTo({ top: feedEl.scrollHeight, behavior: reducedMotion() ? 'auto' : 'smooth' });
	});

	function onmove(uci: string) {
		if (!playing) return;
		const index = run.state.kind === 'student' || run.state.kind === 'fix' ? run.state.index : -1;
		const expected = line.plies[index];
		const from = (index === 0 ? START_FEN : line.plies[index - 1]?.fenAfter ?? START_FEN) as Fen;
		const played = sanOf(uci, from);
		const correct = expected?.uci === uci;
		run = step(run, { type: 'studentMoved', uci: uci as Uci });
		publish();
		if (!correct) {
			if (run.state.kind === 'wrong') {
				const after = new Chess(from);
				after.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || undefined });
				wrong = { san: played, fen: after.fen() as Fen, uci: uci as Uci, verdict: judgeWrongMove(from, uci as Uci) };
			}
			premoveEpoch += 1;
			shake = true;
			setTimeout(() => (shake = false), reducedMotion() ? 0 : 420);
			play('wrong');
			buzz(40);
			onmistake?.();
			return;
		}
		wrong = undefined;
		if (expected) {
			cueFor(expected);
			buzz(12);
			if (mode !== 'learn') {
				flash = { square: expected.uci.slice(2, 4), glyph: '✓', color: 'var(--good)', label: 'Correct' };
				setTimeout(() => (flash = undefined), 700);
			}
		}
	}

	function requestHint() {
		const before = hint;
		run = step(run, { type: 'hint' });
		if (hint !== before) onhint?.();
		publish();
	}

	function takeBack() {
		if (run.state.kind !== 'wrong') return;
		run = step(run, { type: 'retry' });
		wrong = undefined;
		premoveEpoch += 1;
	}

	function fix() {
		if (run.state.kind !== 'wrong' && run.state.kind !== 'student') return;
		wrong = undefined;
		premoveEpoch += 1;
		run = step(run, { type: 'fix' });
	}

	function onkey(event: KeyboardEvent) {
		const target = event.target;
		if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable="true"]')) return;
		if (settingsOpen || leaving) return;
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			run = step(run, { type: 'browse', index: Math.max(0, shownIndex - 1) });
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			run = step(run, { type: 'browse', index: Math.min(liveIndex, shownIndex + 1) });
		} else if (event.key === 'Escape' && run.view !== null) {
			run = step(run, { type: 'resume' });
		} else if ((event.key === 'h' || event.key === 'H') && hint !== 'move' && playing) {
			requestHint();
		} else if (event.key === 'Backspace' && run.state.kind === 'wrong') {
			event.preventDefault();
			takeBack();
		}
	}

	function onbeforeunload(event: BeforeUnloadEvent) {
		if (!active) return;
		event.preventDefault();
	}

	function requestClose(event: MouseEvent) {
		if (!active) return;
		event.preventDefault();
		leaving = true;
	}

	async function toggleSound() {
		muted = !muted;
		preferences = { ...preferences, sound: !muted };
		await setMuted(muted);
	}
</script>

<svelte:window onkeydown={onkey} onbeforeunload={onbeforeunload} />

<div class="trainer" data-text={preferences.textSize}>
	<header class="topbar">
		<a class="icon-btn" href={closeHref} aria-label="Close" onclick={requestClose}>
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
		<button class="icon-btn" onclick={() => (settingsOpen = true)} aria-label="Trainer settings">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" /></svg>
		</button>
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
			<div class="board-row">
				{#if showEval}
					<EvalBar score={evaluation} turn={fen.split(' ')[1] === 'b' ? 'b' : 'w'} orientation={course.side} />
				{/if}
				<Board
					{fen}
					{orientation}
					{movable}
					{lastMove}
					{arrows}
					{marker}
					theme={preferences.theme}
					pieces={preferences.pieces}
					premove={movable === 'w' || movable === 'b' ? { session: `${line.key}:${mode}:${premoveEpoch}` } : undefined}
					{onmove}
				/>
			</div>
		</section>

		<aside class="panel">
			{#if heading}{@render heading()}{/if}
			<div class="title">
				<p class="label">{course.name}</p>
				<h1 class="h-title">{line.name}</h1>
				{#if returnHref}<a class="back-lesson" href={returnHref}>{returnLabel}</a>{/if}
			</div>

			<!-- CR-16: mount LinePicker from #lib/components/courses/LinePicker.svelte in this slot. -->
			<div class="picker-slot" data-line-picker></div>

			<div class="prompt card" class:wrong={run.state.kind === 'wrong'} aria-live="polite">
				{#if run.view !== null}
					<span class="dot opp"></span>
					<p><b>Looking back.</b> The live position is still waiting.</p>
				{:else if run.state.kind === 'opponent' || (run.state.kind === 'fix' && !current?.student)}
					<span class="dot opp"></span>
					<p><b>{opponentName} to move</b></p>
				{:else if (run.state.kind === 'student' || run.state.kind === 'fix') && current}
					<span class="dot you"></span>
					<p>
						<b>{run.state.kind === 'fix' ? 'Play it again.' : 'Your move.'}</b>
						{#if hint === 'move'}
							Play <span class="san">{moveLabel(liveIndex)}{current.san}</span>{arrowKind === 'full' ? ', follow the arrow.' : '.'}
						{:else if hint === 'source'}
							The move starts on <span class="san">{current.uci.slice(0, 2)}</span>.
						{:else}
							What does your repertoire play here?
						{/if}
					</p>
				{:else if run.state.kind === 'wrong' && wrong}
					{#if mode === 'learn'}
						<Mascot expression="encouraging" size={40} />
					{:else}
						<span class="dot bad"></span>
					{/if}
					<div class="wrong-body">
						<p>
							<b>{wrong.san} is not the line.</b>
							{#if wrong.verdict.kind === 'mated'}
								It allows mate: {opponentName} plays <span class="san">{wrong.verdict.reply}</span>.
							{:else if wrong.verdict.kind === 'loses'}
								It drops {wrong.verdict.material >= 3 && wrong.verdict.piece === 'pawn' ? 'material' : `a ${wrong.verdict.piece}`}: {opponentName} answers <span class="san">{wrong.verdict.reply}</span>.
							{:else}
								It doesn't lose anything right away, but your repertoire plays something else here.
							{/if}
						</p>
						<div class="row">
							<button class="btn sm btn-surface" type="button" onclick={takeBack}>Take back</button>
							<button class="btn sm btn-primary" type="button" onclick={fix}>Fix</button>
						</div>
						{#if alternate}
							<a class="alt" href={alternate.href}>This move is in {alternate.name}. Study that line</a>
						{/if}
					</div>
				{:else if run.state.kind === 'done'}
					{#if mode === 'learn'}
						<Mascot expression="celebrating" size={40} />
					{:else}
						<span class="dot good"></span>
					{/if}
					<p>
						<b>{clean ? 'Line complete.' : `Line complete, ${run.mistakes} ${run.mistakes === 1 ? 'mistake' : 'mistakes'}.`}</b>
						{#if open && finalNote} {finalNote}{/if}
					</p>
				{/if}
			</div>

			{#if preferences.coaching === 'tap' && run.state.kind !== 'done'}
				<button class="btn sm btn-surface" type="button" aria-pressed={asked} onclick={() => (asked = !asked)}>{asked ? 'Hide note' : 'Note'}</button>
			{/if}

			{#if open}
				<div class="feed" bind:this={feedEl}>
					{#each feed as { ply, index } (index)}
						{@const latest = index === feed[feed.length - 1]?.index}
						{@const withMascot = mode === 'learn' && latest && run.state.kind !== 'wrong' && run.state.kind !== 'done'}
						<article class="note" class:latest class:mine={ply.student} class:with-mascot={withMascot}>
							{#if withMascot}
								<Mascot expression={lessonExpression} size={40} />
								<div class="note-copy">
									<span class="san">{moveLabel(index)}{ply.san}</span>
									<p>{ply.note ?? 'Played.'}</p>
								</div>
							{:else}
								<span class="san">{moveLabel(index)}{ply.san}</span>
								<p>{ply.note ?? 'Played.'}</p>
							{/if}
						</article>
					{:else}
						{#if mode === 'learn' && run.state.kind !== 'wrong' && run.state.kind !== 'done'}
							<div class="coach-note">
								<Mascot expression={lessonExpression} size={40} />
								<p class="empty">Notes on each move appear here as the line is played.</p>
							</div>
						{/if}
					{/each}
				</div>
			{/if}

			{#if run.view !== null}
				<button class="btn sm btn-primary" type="button" onclick={() => (run = step(run, { type: 'resume' }))}>Back to the live position</button>
			{/if}

			<div class="moves" aria-label="Moves">
				{#each line.plies.slice(0, liveIndex + (run.state.kind === 'done' ? 0 : 1)) as ply, i (i)}
					<button
						type="button"
						class:played={i < shownIndex}
						class:mine={ply.student}
						class:current={i === shownIndex || (i === liveIndex && run.view === null && i === shownIndex)}
						disabled={i > liveIndex}
						onclick={() => (run = step(run, { type: 'browse', index: i + 1 }))}
					>
						{#if ply.color === 'w' || i === 0}<em>{moveLabel(i)}</em>{/if}{i < liveIndex || (hint === 'move' && i === liveIndex) ? ply.san : '?'}
					</button>
				{/each}
			</div>

			{#if hint !== 'move' && (playing || run.state.kind === 'wrong')}
				<button class="btn btn-surface block hint" type="button" onclick={requestHint}>
					<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z" /></svg>
					{hint === 'source' ? 'Show the move' : 'Hint'}
				</button>
			{/if}

			{#if run.state.kind === 'done' && clean && preferences.confetti && !reducedMotion()}
				<div class="confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
			{/if}
		</aside>
	</div>
</div>

{#if settingsOpen}
	<Sheet labelledby="trainer-settings-title" ondismiss={() => (settingsOpen = false)}>
		<h2 id="trainer-settings-title" class="h-title">Settings</h2>
		<SettingsPanel
			{mode}
			courseId={course.id}
			{sharedStartAvailable}
			onchange={(prefs, coursePrefs) => {
				preferences = prefs;
				coursePreferences = coursePrefs;
				muted = !prefs.sound;
			}}
		/>
		{#if mode === 'practice'}
			<ResetCourse courseId={course.id} courseName={course.name} ondone={onreset} />
		{/if}
	</Sheet>
{/if}

{#if leaving}
	<Sheet labelledby="leave-title" ondismiss={() => (leaving = false)}>
		<h2 id="leave-title" class="h-title">Leave this run?</h2>
		<p class="leave-copy">The move you are on is not saved. Finished lines in this run stay saved.</p>
		<button class="btn btn-surface block" type="button" onclick={() => (leaving = false)}>Stay</button>
		{#if onleave}
			<button class="btn btn-primary block" type="button" onclick={() => { leaving = false; onleave?.(); }}>Leave</button>
		{:else}
			<a class="btn btn-primary block" href={closeHref}>Leave</a>
		{/if}
	</Sheet>
{/if}

<style>
	.trainer {
		max-width: 1120px;
		margin: 0 auto;
		padding: 12px var(--gutter) calc(32px + var(--safe-bottom));
	}
	.topbar {
		display: flex;
		align-items: center;
		gap: 8px;
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
	.board-row {
		display: flex;
		align-items: stretch;
		gap: 8px;
	}
	.board-row :global(.board-wrap) {
		flex: 1;
		min-width: 0;
	}
	.panel {
		display: grid;
		gap: 12px;
		align-content: start;
		min-width: 0;
	}
	.picker-slot:empty {
		display: none;
	}
	.title .h-title {
		margin-top: 2px;
	}
	.back-lesson {
		display: inline-block;
		margin-top: 6px;
		color: var(--accent-hi);
		font-size: 14px;
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
	.trainer[data-text='large'] .prompt,
	.trainer[data-text='large'] .note p {
		font-size: 17px;
	}
	.trainer[data-text='xl'] .prompt,
	.trainer[data-text='xl'] .note p {
		font-size: 19px;
	}
	.prompt b {
		color: var(--text);
		font-weight: 600;
	}
	.prompt.wrong {
		border-color: rgba(255, 90, 82, 0.4);
		background: linear-gradient(180deg, rgba(255, 90, 82, 0.1), rgba(255, 90, 82, 0.03)), var(--surface-2);
	}
	.wrong-body,
	.row {
		display: grid;
		gap: 10px;
		justify-items: start;
	}
	.row {
		grid-auto-flow: column;
	}
	.alt {
		color: var(--accent-hi);
		font-size: 14px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		margin-top: 6px;
		flex: 0 0 auto;
	}
	.dot.you {
		position: relative;
		background: var(--accent);
		box-shadow: 0 0 0 4px var(--accent-soft);
	}
	.dot.you::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background: var(--accent);
		animation: pulse 1.6s var(--ease-out) infinite;
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
		from {
			opacity: 0.45;
		}
		to {
			transform: scale(2.6);
			opacity: 0;
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
		transition: opacity var(--dur-press) var(--ease-out);
	}
	.note.latest {
		opacity: 1;
		background: var(--surface-2);
		border-color: var(--stroke-2);
		animation: rise var(--dur-press) var(--ease-out);
	}
	.note.with-mascot {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	.note-copy {
		min-width: 0;
	}
	.coach-note {
		display: flex;
		align-items: center;
		gap: 10px;
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
	.moves button {
		padding: 0 6px;
		border: 0;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		font: inherit;
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
	.leave-copy {
		color: var(--text-2);
		margin: 8px 0 14px;
	}
	.shake {
		animation: shake 0.4s var(--ease-out);
	}
	.confetti {
		position: relative;
		height: 0;
	}
	.confetti i {
		position: absolute;
		left: 50%;
		width: 8px;
		height: 8px;
		border-radius: 2px;
		background: var(--accent);
		animation: burst 700ms var(--ease-out) forwards;
	}
	.confetti i:nth-child(2) {
		background: var(--good);
		animation-delay: 40ms;
	}
	.confetti i:nth-child(3) {
		background: var(--accent-hi);
		animation-delay: 80ms;
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
	@keyframes burst {
		to {
			transform: translateY(-28px) translateX(12px);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.shake,
		.dot.you::after,
		.note.latest,
		.confetti i {
			animation: none;
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
