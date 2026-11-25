<script lang="ts">
 import { onMount } from 'svelte';
 import { courses } from '#lib/courses/index.ts';
 import { db, type LineProgress } from '#lib/db.ts';
 let rows = $state<LineProgress[]>([]); let courseId = $state(''); let chapterId = $state('');
 let course = $derived(courses.find(c => c.id === courseId));
 let scoped = $derived(rows.filter(p => (!courseId || p.courseId === courseId) && (!chapterId || course?.chapters.find(c => c.id === chapterId)?.lines.some(l => l.key === p.key))));
 let due = $derived(scoped.filter(p => new Date(p.card.due).getTime() <= Date.now()));
 let query = $derived(new URLSearchParams({ course: courseId, chapter: chapterId, ahead: due.length ? '0' : '1' }).toString());
 onMount(async () => { rows = await db.progress.toArray(); });
</script>
<main class="page stack landing"><a href="/">← Home</a><p class="label">YOUR REPERTOIRE</p><h1 class="h-display">Practice</h1><p class="muted">Keep your lines fresh with spaced repetition.</p>
 <label>Course<select class="field" bind:value={courseId} onchange={() => chapterId = ''}><option value="">All courses</option>{#each courses as c}<option value={c.id}>{c.name}</option>{/each}</select></label>
 {#if course}<label>Chapter<select class="field" bind:value={chapterId}><option value="">All chapters</option>{#each course.chapters as c}<option value={c.id}>{c.name}</option>{/each}</select></label>{/if}
 <div class="card summary"><span class="label">READY TO REVIEW</span><strong>{due.length}</strong><p class="muted">{due.length === 1 ? 'line' : 'lines'} due · {scoped.length} learned</p></div>
 {#if scoped.length}<a class="btn btn-primary" href="/practice/run?{query}">{due.length ? 'Start practice' : 'Review ahead'}</a>{:else}<p>Learn a line to start practicing.</p><a class="btn btn-surface" href="/">Explore courses</a>{/if}
</main>
<style>.landing{padding-top:24px;gap:16px}.landing label{display:grid;gap:6px}.field{width:100%}.summary{padding:24px;display:grid;gap:4px}.summary strong{font-size:42px}</style>
