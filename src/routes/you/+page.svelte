<script lang="ts">
 import { onMount } from 'svelte';
 import { db, dayKey, getSetting, setSetting, type LineProgress, type SessionLog } from '#lib/db.ts';
 import { courses } from '#lib/courses/index.ts';
 import { streak } from '#lib/progress.ts';
 let today = new Date(); let calendar = Array.from({length: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()}, (_, i) => dayKey(new Date(today.getFullYear(), today.getMonth(), i + 1).getTime()));
 let sessions = $state<SessionLog[]>([]); let progress = $state<LineProgress[]>([]); let muted = $state(false); let confirmReset = $state(false);
 onMount(async () => { sessions = await db.sessions.toArray(); progress = await db.progress.toArray(); muted = await getSetting('muted', false); });
 async function reset() { await db.transaction('rw', db.progress, db.sessions, async () => { await db.progress.clear(); await db.sessions.clear(); }); progress = []; sessions = []; confirmReset = false; }
</script>
<main class="page stack" style="padding-top:24px"><h1 class="h-display">You</h1><div class="card">🔥 {streak(sessions.map(s => s.day))} day streak · {sessions.reduce((n,s) => n+s.xp, 0)} XP</div>
<h2>Courses</h2>{#each courses as course}<div class="card">{course.name}: {progress.filter(p => p.courseId === course.id).length} / {course.lines.length} lines learned</div>{/each}
<h2>Personal bests</h2><p>Drill: {Math.max(0, ...sessions.filter(s => s.mode === 'drill').map(s => s.score ?? 0))} · Time: {Math.max(0, ...sessions.filter(s => s.mode === 'time').map(s => s.score ?? 0))}</p>
<h2>Activity · {today.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</h2><div class="calendar">{#each calendar as day}<span class:active={sessions.some(s => s.day === day)} title={day}>{Number(day.slice(-2))}</span>{/each}</div>
<label><input type="checkbox" bind:checked={muted} onchange={() => setSetting('muted', muted)} /> Mute sounds</label>
{#if confirmReset}<p>Delete all training progress and sessions?</p><button class="btn" onclick={reset}>Yes, reset progress</button><button class="btn" onclick={() => confirmReset = false}>Cancel</button>{:else}<button class="btn" onclick={() => confirmReset = true}>Reset progress</button>{/if}</main>

<style>.calendar{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}.calendar span{display:grid;place-items:center;aspect-ratio:1;border-radius:9px;background:var(--surface-2);color:var(--text-3)}.calendar .active{background:var(--accent-soft);color:var(--accent-hi)}</style>
