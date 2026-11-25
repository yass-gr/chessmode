<script lang="ts">
 import { onMount } from 'svelte'; import { page } from '$app/state';
 import { findCourse } from '#lib/courses/index.ts'; import { db, type LineProgress } from '#lib/db.ts';
 let course = $derived(findCourse(page.params.id)); let tab = $state<'lines' | 'chapters' | 'quiz'>('lines'); let progress = $state<LineProgress[]>([]);
 let next = $derived(course?.lines.find(l => !progress.some(p => p.key === l.key)) ?? course?.lines[0]);
 onMount(async () => { progress = await db.progress.toArray(); });
</script>
<main class="page stack course"><a href="/">← Home</a>{#if course}<div class="hero card"><img src="/img/board-hero.webp" alt="" /><div><span class="chip">{course.side === 'w' ? 'White' : 'Black'} · {course.level}</span><h1 class="h-display">{course.name}</h1><p>{course.description}</p></div></div>
<div class="row"><strong>{progress.filter(p => p.courseId === course.id).length} / {course.lines.length} lines learned</strong></div><div class="progress"><i style:width={`${100 * progress.filter(p => p.courseId === course.id).length / course.lines.length}%`}></i></div>
{#if next}<a class="btn btn-primary" href="/learn/{course.id}/{next.id}">Continue learning →</a>{/if}
<div class="seg"><button aria-pressed={tab === 'lines'} onclick={() => tab = 'lines'}>Lines</button><button aria-pressed={tab === 'chapters'} onclick={() => tab = 'chapters'}>Chapters</button><button aria-pressed={tab === 'quiz'} onclick={() => tab = 'quiz'}>Quiz</button></div>
{#each course.chapters as chapter}<section class="stack"><h2 class="h-title">{chapter.name}</h2>{#if tab === 'lines'}{#each chapter.lines as line}{@const row = progress.find(p => p.key === line.key)}<a class="card item" href="/learn/{course.id}/{line.id}"><span>{row ? '✓' : '○'} &nbsp; {line.name}</span><small class="muted">{row ? `Due ${new Date(row.card.due).toLocaleDateString()}` : 'Learn'} →</small></a>{/each}{:else if tab === 'chapters'}<p class="muted">{chapter.intro}</p>{:else if chapter.quiz.length}<a class="card item" href="/quiz/{course.id}/{chapter.id}">Test your plans <span>→</span></a>{:else}<p class="muted">No quiz for this chapter yet.</p>{/if}</section>{/each}{:else}<h1>Course not found</h1>{/if}</main>
<style>.course{padding-top:24px;gap:16px}.hero img{width:100%;height:160px;object-fit:cover}.hero>div{padding:20px;display:grid;gap:10px}.hero p{color:var(--text-2)}.item{padding:16px;display:flex;justify-content:space-between;gap:10px;align-items:center}.item small{text-align:right;white-space:nowrap}section{margin-top:8px}</style>
