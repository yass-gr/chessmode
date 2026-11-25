<script lang="ts">
 import { onMount } from 'svelte';
 import { page } from '$app/state';
 import Board from '#lib/components/Board.svelte';
 import { START_FEN, type Uci } from '#lib/chess/types.ts';
 import { courses } from '#lib/courses/index.ts';
 import type { Course, Line } from '#lib/courses/types.ts';
 import { db } from '#lib/db.ts';
 import { timeRemaining } from '#lib/train/session.ts';
 import { startLine, step } from '#lib/train/reducer.ts';
 import { logSession } from '#lib/progress.ts';
 import type { LineRun } from '#lib/train/types.ts';
 let mode: 'time' | 'drill' = $derived(page.url.searchParams.get('mode') === 'time' ? 'time' : 'drill');
 let pool = $state<{course: Course; line: Line}[]>([]); let loaded = $state(false); let score = $state(0); let mistakes = $state(0); let remaining = $state(60); let ended = $state(false); let logged = $state(false); let run = $state<LineRun>(); let selected = $state<{course: Course; line: Line}>();
 onMount(async () => { const params = page.url.searchParams; const progress = await db.progress.toArray(); pool = courses.filter(c => !params.get('course') || c.id === params.get('course')).flatMap(course => course.lines.filter(line => progress.some(p => p.key === line.key) && (!params.get('chapter') || line.chapterId === params.get('chapter'))).map(line => ({course,line}))); loaded = true; });
 $effect(() => { if (loaded && pool.length && !run && !ended) { selected = pool[Math.floor(Math.random() * pool.length)]; run = startLine(selected.line, mode); } });
 $effect(() => { if (mode === 'time' && loaded && pool.length && !ended) { const timer = setInterval(() => { remaining = timeRemaining(remaining, 'tick'); if (!remaining) ended = true; }, 1000); return () => clearInterval(timer); } });
 $effect(() => { if (run?.state.kind === 'opponent') { const timer = setTimeout(() => { if (run) run = step(run, { type: 'opponentPlayed' }); }, 450); return () => clearTimeout(timer); }
 if (run?.state.kind === 'wrong') { const timer = setTimeout(() => { if (run) run = step(run, { type: 'retry' }); }, 650); return () => clearTimeout(timer); }
 if (run?.state.kind === 'done' && !ended) { if (mode === 'drill' && run.mistakes) ended = true; else { if (!run.mistakes) { score++; if (mode === 'time') remaining = timeRemaining(remaining, 'clean'); } run = undefined; } }
 });
 $effect(() => { if (ended && !logged) { logged = true; void logSession({ mode, courseId: page.url.searchParams.get('course') || undefined, lines: score, mistakes, score }); } });
 function move(uci: string) { if (!run) return; const before = run.mistakes; run = step(run, { type: 'studentMoved', uci: uci as Uci }); if (run.mistakes > before) { mistakes++; if (mode === 'time') { remaining = timeRemaining(remaining, 'mistake'); if (!remaining) ended = true; } } }
 let index = $derived(run && run.state.kind !== 'done' ? run.state.index : 0); let fen = $derived(!run || index === 0 ? START_FEN : run.line.plies[index - 1].fenAfter);
 let current = $derived(run?.line.plies[index]); let arrows = $derived(run?.state.kind === 'wrong' && current ? [{from:current.uci.slice(0,2),to:current.uci.slice(2,4),brush:'accent' as const}] : []);
</script>
<main class="page stack" style="padding-top:24px;max-width:620px;gap:16px"><a href="/drill">✕ Close</a>{#if ended}<div class="card" style="padding:24px"><h1>Run complete</h1><p>Score: {score} · {mistakes} mistakes</p></div><a class="btn btn-primary" href="/drill">Continue</a>{:else if run && selected}<p class="label">{mode === 'time' ? 'TIME' : 'DRILL'}</p><h1 class="h-display">{mode === 'time' ? `${remaining}s` : `Streak ${score}`}</h1><p>{selected.course.name} · {run.line.name}</p><Board {fen} orientation={selected.course.side === 'w' ? 'white' : 'black'} movable={run.state.kind === 'student' ? selected.course.side : 'none'} {arrows} onmove={move} />{#if run.state.kind === 'wrong'}<p role="status">Try again · −5 seconds</p>{/if}{:else if loaded}<p>No learned lines in this scope.</p><a href="/drill">Back to drill</a>{:else}<p>Loading…</p>{/if}</main>
