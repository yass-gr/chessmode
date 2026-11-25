<script lang="ts">
 import { page } from '$app/state';
 import Board from '#lib/components/Board.svelte';
 import { START_FEN } from '#lib/chess/types.ts';
 import { findCourse } from '#lib/courses/index.ts';
 import { logSession } from '#lib/progress.ts';
 let course = $derived(findCourse(page.params.course));
 let chapter = $derived(course?.chapters.find(c => c.id === page.params.chapter));
 let index = $state(0); let selected = $state<number>(); let checked = $state(false); let correct = $state(0);
 let quiz = $derived(chapter?.quiz[index]);
 function check() { if (selected === undefined || !quiz) return; checked = true; if (selected === quiz.answer) correct++; }
 function next() { if (!chapter || !course) return; if (index + 1 === chapter.quiz.length) void logSession({ mode: 'quiz', courseId: course.id, lines: 0, mistakes: chapter.quiz.length - correct, correct }); index++; selected = undefined; checked = false; }
</script>
<main class="page stack" style="padding-top:24px;max-width:620px"><a href="/course/{page.params.course}">✕ Close</a>
{#if quiz && course}<h1>{quiz.question}</h1><Board fen={quiz.plies.at(-1)?.fenAfter ?? START_FEN} orientation={course.side === 'w' ? 'white' : 'black'} />
{#each quiz.options as option, i}<button class="option" class:selected={selected === i && !checked} class:correct={checked && i === quiz.answer} class:wrong={checked && selected === i && i !== quiz.answer} aria-pressed={selected === i} disabled={checked} onclick={() => selected = i}>{option}</button>{/each}
{#if checked}<div class="card" style="padding:20px">{selected === quiz.answer ? 'Correct!' : 'Not quite.'} {quiz.explanation}</div><button class="btn btn-primary" onclick={next}>Continue</button>{:else}<button class="btn btn-primary" disabled={selected === undefined} onclick={check}>Check</button>{/if}
{:else if chapter}<h1>Quiz complete</h1><p>{correct} correct out of {chapter.quiz.length}</p><a class="btn btn-primary" href="/course/{page.params.course}">Continue</a>{:else}<h1>Chapter not found</h1>{/if}</main>
