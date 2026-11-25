<script lang="ts">
 import { onMount, untrack } from 'svelte';
 import Board from '#lib/components/Board.svelte';
 import { START_FEN, type Uci } from '#lib/chess/types.ts';
 import type { Course, Line } from '#lib/courses/types.ts';
 import type { TrainerMode } from '#lib/train/types.ts';
 import { startLine, step } from '#lib/train/reducer.ts';
 import { finishLearn, finishPractice } from '#lib/srs.ts';
 import { logSession } from '#lib/progress.ts';
 import { getSetting, setSetting } from '#lib/db.ts';
 let { course, line, mode, oncontinue }: { course: Course; line: Line; mode: TrainerMode; oncontinue?: () => void } = $props();
 let run = $state(untrack(() => startLine(line, mode)));
 let saved = $state(false); let due = $state<Date>(); let muted = $state(false); let flash = $state(false);
 let index = $derived(run.state.kind === 'done' ? line.plies.length : run.state.index);
 let fen = $derived(index === 0 ? START_FEN : line.plies[index - 1].fenAfter);
 let current = $derived(line.plies[index]); let last = $derived(index ? line.plies[index - 1] : undefined); let note = $derived(line.plies.slice(0, index).findLast(p => p.note)?.note);
 let arrow = $derived((run.state.kind === 'student' || run.state.kind === 'wrong') && run.state.revealed && current ? [{ from: current.uci.slice(0, 2), to: current.uci.slice(2, 4), brush: 'accent' as const }] : []);
 onMount(async () => { muted = await getSetting('muted', false); });
 $effect(() => {
  if (run.state.kind === 'opponent') { const timer = setTimeout(() => run = step(run, { type: 'opponentPlayed' }), 450); return () => clearTimeout(timer); }
  if (run.state.kind === 'wrong') { const timer = setTimeout(() => run = step(run, { type: 'retry' }), 650); return () => clearTimeout(timer); }
  if (run.state.kind === 'done' && !saved) {
   saved = true;
   void (async () => { const result = mode === 'learn' ? await finishLearn(line.key, course.id) : mode === 'practice' ? await finishPractice(line.key, run.mistakes, run.hints) : undefined; due = result?.card.due; await logSession({ mode, courseId: course.id, lines: 1, mistakes: run.mistakes }); })();
  }
 });
 function move(uci: string) {
  const before = run.mistakes; const previous = run.state;
  run = step(run, { type: 'studentMoved', uci: uci as Uci });
  if (previous.kind === 'student' && run.mistakes === before) {
   flash = true; setTimeout(() => flash = false, 300);
   if (!muted) { const audio = new AudioContext(); const osc = audio.createOscillator(); const gain = audio.createGain(); osc.frequency.value = 600; gain.gain.setValueAtTime(0.04, audio.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.06); osc.connect(gain).connect(audio.destination); osc.start(); osc.stop(audio.currentTime + 0.06); osc.onended = () => void audio.close(); }
  }
 }
</script>
<main class="page stack runner">
 <header class="row"><a class="icon-btn" href={mode === 'learn' ? `/course/${course.id}` : '/practice'} aria-label="Close">✕</a><div class="progress" style="flex:1"><i style:width={`${100 * index / line.plies.length}%`}></i></div><span class="label">{index}/{line.plies.length}</span><button class="icon-btn" aria-label={muted ? 'Unmute sound' : 'Mute sound'} onclick={() => { muted = !muted; void setSetting('muted', muted); }}>{muted ? '♩' : '♪'}</button></header>
 {#if run.state.kind === 'done'}
  <div class="card complete"><p class="label">LINE COMPLETE</p><h1 class="h-display">Well played!</h1><p>{run.mistakes} mistakes · {run.hints} hints</p>{#if due}<p class="muted">Next review: {new Date(due).toLocaleDateString()}</p>{/if}{#if oncontinue}<button class="btn btn-primary" onclick={oncontinue}>Continue</button>{:else}<a class="btn btn-primary" href="/">Continue</a>{/if}</div>
 {:else}
  <div><p class="label">{mode.toUpperCase()} · {course.name}</p><h1 class="h-title">{line.name}</h1></div>
  <div class:shake={run.state.kind === 'wrong'} class:flash><Board {fen} orientation={course.side === 'w' ? 'white' : 'black'} movable={run.state.kind === 'student' ? course.side : 'none'} lastMove={last ? [last.uci.slice(0, 2), last.uci.slice(2, 4)] : undefined} arrows={arrow} onmove={move} /></div>
  <div class="moves" aria-label="Moves">{#each line.plies as ply, i}<span class:current={i === index}>{i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}{ply.san}</span>{/each}</div>
  <div class="card note"><strong>{run.state.kind === 'wrong' ? 'Try again' : run.state.kind === 'student' ? 'Your move' : 'Opponent’s move'}</strong><p class="muted">{mode === 'learn' ? note ?? 'Follow the arrow to learn the line.' : run.state.kind === 'wrong' ? 'The correct move is shown on the board.' : 'Find the move you learned.'}</p></div>
  {#if mode !== 'learn' && run.state.kind === 'student'}<button class="btn btn-surface" onclick={() => run = step(run, { type: 'hint' })}>Show hint</button>{/if}
 {/if}
</main>
<style>
 .runner{padding-top:20px;max-width:620px;gap:16px}.complete,.note{padding:20px;display:grid;gap:10px}.complete{margin-top:60px;text-align:center}.moves{display:flex;gap:6px;overflow-x:auto;white-space:nowrap;color:var(--text-3);font:13px var(--mono)}.moves span{padding:4px;border-radius:4px}.moves .current{background:var(--surface-3);color:var(--text)}.shake{animation:shake .35s}.flash :global(cg-board square.last-move){animation:square-flash .3s}@keyframes square-flash{50%{background-color:rgba(255,255,255,.7)}}@keyframes shake{25%,75%{transform:translateX(-5px)}50%{transform:translateX(5px)}}
</style>
