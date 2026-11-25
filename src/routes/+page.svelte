<script lang="ts">
 import { onMount } from 'svelte';
 import { courses } from '#lib/courses/index.ts';
 import { db, getSetting, setSetting, type LineProgress } from '#lib/db.ts';
 import { dueQueue } from '#lib/srs.ts';
 import { streak } from '#lib/progress.ts';
 let selected = $state<string>(courses[0]?.id ?? ''); let progress = $state<LineProgress[]>([]); let due = $state(0); let days = $state<string[]>([]);
 let course = $derived(courses.find(c => c.id === selected) ?? courses[0]);
 let next = $derived(course?.lines.find(l => !progress.some(p => p.key === l.key)));
 onMount(async () => { selected = await getSetting('course', selected); progress = await db.progress.toArray(); due = (await dueQueue()).length; days = (await db.sessions.toArray()).map(s => s.day); });
 async function changeCourse(event: Event) { selected = (event.currentTarget as HTMLSelectElement).value; await setSetting('course', selected); }
</script>
<main class="page home stack"><header class="row"><strong class="brand">CHESSMODE</strong><a class="streak" href="/you"><img src="/img/flame.webp" alt="" /> {streak(days)}</a></header>
<label class="label" for="course">YOUR COURSE</label><select id="course" class="field" value={selected} onchange={changeCourse}>{#each courses as item}<option value={item.id}>{item.name}</option>{/each}</select>
{#if course}<div class="row title"><div><h1 class="h-display">{course.name}</h1><p class="muted">{course.tagline}</p></div><a href="/course/{course.id}" aria-label="Course details">→</a></div>
{#each course.chapters as chapter, ci}<section><div class="card module"><span class="label">MODULE {ci + 1}</span><h2 class="h-head">{chapter.name}</h2><span class="muted">{chapter.lines.length} lines</span></div><div class="path">{#each chapter.lines as line, i}{@const learned = progress.some(p => p.key === line.key)}{@const active = next?.key === line.key}<a class="node" class:offset={i % 2 === 1} href="/learn/{course.id}/{line.id}" aria-label="{line.name}{learned ? ', learned' : active ? ', next line' : ', preview'}"><img src={learned ? '/img/node-done.webp' : active ? '/img/node-active.webp' : '/img/node-locked.webp'} alt="" /><span>{line.name}</span></a>{#if active}<div class="card glow next"><span class="label">UP NEXT</span><strong>{line.name}</strong><a class="btn btn-primary sm" href="/learn/{course.id}/{line.id}">Continue line →</a>{#if due}<a href="/practice">Practice {due} due →</a>{/if}</div>{/if}{/each}</div></section>{/each}
{:else}<p>No courses available yet.</p>{/if}</main>
<style>.home{padding-top:24px;gap:16px}.brand{letter-spacing:.12em}.streak{margin-left:auto;display:flex;align-items:center;font-weight:700}.streak img{width:36px;height:36px;object-fit:contain}.field{width:100%}.title{justify-content:space-between;align-items:start}.title p{margin-top:8px}.title>a{font-size:28px}.module{padding:18px 20px;display:grid;gap:4px}.path{position:relative;display:grid;justify-items:center;gap:4px;padding:14px 0}.path:before{content:'';position:absolute;top:35px;bottom:35px;width:2px;background:var(--surface-3)}.node{position:relative;display:grid;justify-items:center;width:180px;text-align:center;font-size:13px;color:var(--text-2)}.node img{width:105px;height:90px;object-fit:contain}.node.offset{transform:translateX(55px)}.node:not(.offset){transform:translateX(-55px)}.next{padding:16px;display:grid;gap:8px;text-align:center;z-index:1;width:min(260px,100%);margin:8px}.next>a:not(.btn){font-size:13px;color:var(--text-2)}</style>
