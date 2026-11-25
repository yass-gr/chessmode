<script lang="ts">
 import { onMount } from 'svelte';
 import { courses } from '#lib/courses/index.ts';
 import { db, type SessionLog, type LineProgress } from '#lib/db.ts';
 let courseId = $state(''); let chapterId = $state(''); let sessions = $state<SessionLog[]>([]); let learned = $state<LineProgress[]>([]);
 let course = $derived(courses.find(c => c.id === courseId));
 let count = $derived(learned.filter(p => (!courseId || p.courseId === courseId) && (!chapterId || course?.chapters.find(c => c.id === chapterId)?.lines.some(l => l.key === p.key))).length);
 let query = $derived(new URLSearchParams({course:courseId, chapter:chapterId}).toString());
 onMount(async () => { sessions = await db.sessions.toArray(); learned = await db.progress.toArray(); });
</script>
<main class="page stack landing"><a href="/">← Home</a><p class="label">BUILD YOUR INSTINCTS</p><h1 class="h-display">Drill</h1><p class="muted">Play learned lines back to back. How long can you keep your streak?</p>
<label>Course<select class="field" bind:value={courseId} onchange={() => chapterId = ''}><option value="">All courses</option>{#each courses as c}<option value={c.id}>{c.name}</option>{/each}</select></label>
{#if course}<label>Chapter<select class="field" bind:value={chapterId}><option value="">All chapters</option>{#each course.chapters as c}<option value={c.id}>{c.name}</option>{/each}</select></label>{/if}
<div class="card summary"><p>{count} learned lines available</p><p class="muted">Personal best · Drill {Math.max(0,...sessions.filter(s => s.mode === 'drill').map(s => s.score ?? 0))} · Time {Math.max(0,...sessions.filter(s => s.mode === 'time').map(s => s.score ?? 0))}</p></div>
{#if count}<a class="btn btn-primary" href="/drill/run?{query}&mode=drill">Start drill</a><a class="btn btn-surface" href="/drill/run?{query}&mode=time">Start 60-second run</a>{:else}<a class="btn btn-surface" href="/">Learn a line first</a>{/if}</main>
<style>.landing{padding-top:24px;gap:16px}.landing label{display:grid;gap:6px}.field{width:100%}.summary{padding:20px;display:grid;gap:8px}</style>
