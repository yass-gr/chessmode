<script lang="ts">
 import { onMount } from 'svelte';
 import { page } from '$app/state';
 import { courses } from '#lib/courses/index.ts';
 import { db, type LineProgress } from '#lib/db.ts';
 import Runner from '#lib/components/train/Runner.svelte';
 let rows = $state<LineProgress[]>([]); let loaded = $state(false); let index = $state(0);
 onMount(async () => { const params = page.url.searchParams; const courseId = params.get('course'); const chapterId = params.get('chapter'); const key = params.get('line'); const ahead = params.get('ahead') === '1'; const now = Date.now();
  rows = (await db.progress.toArray()).filter(p => (!key || p.key === key) && (!courseId || p.courseId === courseId) && (!chapterId || courses.find(c => c.id === p.courseId)?.chapters.find(c => c.id === chapterId)?.lines.some(l => l.key === p.key)) && (ahead || !!key || new Date(p.card.due).getTime() <= now)).sort((a,b) => +new Date(a.card.due) - +new Date(b.card.due)); loaded = true;
 });
 let row = $derived(rows[index]); let course = $derived(courses.find(c => c.id === row?.courseId)); let line = $derived(course?.lines.find(l => l.key === row?.key));
</script>
{#if course && line}{#key line.key}<Runner {course} {line} mode="practice" oncontinue={() => index++} />{/key}{:else if loaded}<main class="page stack" style="padding-top:30px"><h1>Practice complete</h1><p>{rows.length} lines reviewed.</p><a class="btn btn-primary" href="/practice">Continue</a></main>{:else}<main class="page">Loading…</main>{/if}
