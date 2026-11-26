<script lang="ts">
	import { X } from '@lucide/svelte';
	import { page } from '$app/state';
	import Board from '#lib/components/Board.svelte';
	import ResultSheet from '#lib/components/train/ResultSheet.svelte';
	import { START_FEN } from '#lib/chess/types.ts';
	import { getCourse } from '#lib/courses/index.ts';
	import { logSession } from '#lib/progress.ts';
	import { play } from '#lib/sound.ts';

	const course = $derived(getCourse(page.params.course));
	const chapter = $derived(course?.chapters.find((c) => c.id === page.params.chapter));
	let index = $state(0);
	let selected = $state<number>();
	let checked = $state(false);
	let correct = $state(0);
	let finished = $state(false);

	const quiz = $derived(chapter?.quiz[index]);
	const last = $derived(quiz?.plies.at(-1));
	const total = $derived(chapter?.quiz.length ?? 0);
	const letters = 'ABCD';

	function check() {
		if (selected === undefined || !quiz) return;
		checked = true;
		const ok = selected === quiz.answer;
		if (ok) correct++;
		play(ok ? 'correct' : 'wrong');
	}

	function next() {
		if (!chapter || !course) return;
		if (index + 1 >= total) {
			finished = true;
			play('complete');
			void logSession({ mode: 'quiz', courseId: course.id, lines: 0, mistakes: total - correct, correct });
			return;
		}
		index++;
		selected = undefined;
		checked = false;
	}

	function restart() {
		index = 0;
		selected = undefined;
		checked = false;
		correct = 0;
		finished = false;
	}
</script>

<svelte:head><title>Quiz · {chapter?.name ?? ''} · Chessmode</title></svelte:head>

{#if course && chapter && quiz}
	<main class="quiz">
		<header class="top">
			<div>
				<p class="label">{chapter.name}</p>
				<h1 class="h-head">Find the plan</h1>
			</div>
			<a class="close" href="/course/{course.id}" aria-label="Close" style:--p={index / total}>
				<X size={18} stroke-width={1.75} />
			</a>
		</header>

		<div class="layout">
			<div class="board-col">
				<Board
					fen={last?.fenAfter ?? START_FEN}
					orientation={course.side === 'w' ? 'white' : 'black'}
					lastMove={last ? [last.uci.slice(0, 2), last.uci.slice(2, 4)] : undefined}
				/>
			</div>
			<section class="qa">
				<p class="count">Question {index + 1} of {total}</p>
				<h2 class="question">{quiz.question}</h2>
				<div class="options">
					{#each quiz.options as option, i (i)}
						<button
							class="option"
							class:selected={selected === i && !checked}
							class:correct={checked && i === quiz.answer}
							class:wrong={checked && selected === i && i !== quiz.answer}
							aria-pressed={selected === i}
							disabled={checked}
							onclick={() => (selected = i)}
						>
							<b>{letters[i]}.</b>{option}
						</button>
					{/each}
				</div>
				{#if checked}
					<div class="explain card" class:ok={selected === quiz.answer}>
						<b>{selected === quiz.answer ? 'Correct.' : `The answer is ${letters[quiz.answer]}.`}</b>
						{quiz.explanation}
					</div>
				{/if}
				<div class="actions">
					{#if checked}
						<button class="btn btn-primary block" onclick={next}>{index + 1 >= total ? 'See results' : 'Next question'}</button>
					{:else}
						<button class="btn btn-primary block" disabled={selected === undefined} onclick={check}>Check answer</button>
					{/if}
				</div>
			</section>
		</div>
	</main>

	{#if finished}
		<ResultSheet
			image="/img/result/quiz.webp"
			eyebrow="Quiz complete · +{correct * 3} XP"
			title="{correct} of {total} correct"
			subtitle={correct === total ? 'You know the plans in this chapter.' : 'Read the chapter ideas again, then retry.'}
		>
			{#snippet actions()}
				<a class="btn btn-primary block" href="/course/{course.id}">Back to course</a>
				<button class="btn btn-surface block" onclick={restart}>Try again</button>
			{/snippet}
		</ResultSheet>
	{/if}
{:else}
	<main class="page" style="padding-top:48px">
		<h1 class="h-title">Quiz not found</h1>
		<a class="btn btn-surface" href="/">Home</a>
	</main>
{/if}

<style>
	.quiz {
		max-width: 1080px;
		margin: 0 auto;
		padding: 14px var(--gutter) calc(32px + var(--safe-bottom));
	}
	.top {
		display: flex;
		align-items: center;
		gap: 12px;
		padding-bottom: 16px;
	}
	.top > div {
		flex: 1;
	}
	.close {
		--p: 0;
		width: 42px;
		height: 42px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: conic-gradient(var(--accent) calc(var(--p) * 360deg), var(--surface-3) 0);
		position: relative;
	}
	.close::before {
		content: '';
		position: absolute;
		inset: 4px;
		border-radius: 50%;
		background: var(--surface-2);
	}
	.close :global(svg) {
		position: relative;
		z-index: 1;
	}
	.layout {
		display: grid;
		gap: 18px;
	}
	.board-col {
		width: min(100%, 260px);
	}
	.count {
		font-size: 14px;
		color: var(--text-3);
	}
	.question {
		margin: 6px 0 16px;
		font-size: 21px;
		line-height: 1.3;
		font-weight: 500;
		letter-spacing: -0.02em;
	}
	.options {
		display: grid;
		gap: 10px;
	}
	.option[disabled] {
		cursor: default;
	}
	.explain {
		margin-top: 12px;
		padding: 14px 16px;
		font-size: 14px;
		line-height: 1.55;
		color: var(--text-2);
		border-color: rgba(255, 90, 82, 0.35);
	}
	.explain.ok {
		border-color: rgba(62, 207, 142, 0.35);
	}
	.explain b {
		color: var(--text);
	}
	.actions {
		margin-top: 16px;
	}
	@media (min-width: 900px) {
		.layout {
			grid-template-columns: minmax(0, 520px) minmax(320px, 440px);
			justify-content: center;
			align-items: start;
			gap: 32px;
		}
		.board-col {
			width: 100%;
		}
	}
</style>
