<script lang="ts">
	import { onMount } from 'svelte';
	import { db, dayKey, type LineProgress, type SessionLog } from '#lib/db.ts';
	import { courses } from '#lib/courses/index.ts';
	import { streak } from '#lib/progress.ts';
	import { best, totalXp } from '#lib/train/stats.ts';
	import { isMuted, setMuted } from '#lib/sound.ts';

	let sessions = $state<SessionLog[]>([]);
	let progress = $state<LineProgress[]>([]);
	let muted = $state(isMuted());
	let confirming = $state(false);

	const today = new Date();
	const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
	/** Monday-first offset of the 1st of the month. */
	const lead = (monthStart.getDay() + 6) % 7;
	const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
	const calendar = Array.from({ length: daysInMonth }, (_, i) => dayKey(new Date(today.getFullYear(), today.getMonth(), i + 1).getTime()));
	const todayKey = dayKey();

	onMount(async () => {
		[sessions, progress] = await Promise.all([db.sessions.toArray(), db.progress.toArray()]);
	});

	const active = $derived(new Set(sessions.map((s) => s.day)));
	const current = $derived(streak(sessions.map((s) => s.day)));
	const longest = $derived.by(() => {
		const days = [...active].sort();
		let run = 0;
		let max = 0;
		let prev: number | undefined;
		for (const d of days) {
			const t = new Date(d + 'T12:00:00').getTime();
			run = prev !== undefined && Math.round((t - prev) / 86_400_000) === 1 ? run + 1 : 1;
			max = Math.max(max, run);
			prev = t;
		}
		return max;
	});
	const reviews = $derived(progress.reduce((s, p) => s + p.reviews, 0));

	async function toggleSound() {
		muted = !muted;
		await setMuted(muted);
	}

	async function reset() {
		await db.transaction('rw', db.progress, db.sessions, async () => {
			await db.progress.clear();
			await db.sessions.clear();
		});
		progress = [];
		sessions = [];
		confirming = false;
	}
</script>

<svelte:head><title>You · Chessmode</title></svelte:head>

<main class="page">
	<section class="hero">
		<img src="/img/flame.webp" alt="" />
		<div class="big">{current}</div>
		<p class="h-head">day streak</p>
		<p class="muted">{current ? 'Train today to keep it going.' : 'Finish any session to start a streak.'}</p>
	</section>

	<div class="card month">
		<div class="month-head"><b>{today.toLocaleString(undefined, { month: 'long' })}</b><span class="muted">Best: {longest} {longest === 1 ? 'day' : 'days'}</span></div>
		<div class="cal">
			{#each ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as d, i (i)}<span class="dow">{d}</span>{/each}
			{#each { length: lead } as _, i (i)}<span></span>{/each}
			{#each calendar as day (day)}
				<i class:on={active.has(day)} class:today={day === todayKey}>{Number(day.slice(-2))}</i>
			{/each}
		</div>
	</div>

	<div class="tiles">
		<div class="card tile"><span>Total XP</span><b>{totalXp(sessions)}</b></div>
		<div class="card tile"><span>Lines learned</span><b>{progress.length}</b></div>
		<div class="card tile"><span>Reviews</span><b>{reviews}</b></div>
		<div class="card tile"><span>Best drill</span><b>{best(sessions, 'drill')}</b></div>
		<div class="card tile"><span>Best time run</span><b>{best(sessions, 'time')}</b></div>
		<div class="card tile"><span>Sessions</span><b>{sessions.length}</b></div>
	</div>

	<h2 class="label section">Courses</h2>
	<div class="card list">
		{#each courses as course (course.id)}
			{@const n = progress.filter((p) => p.courseId === course.id).length}
			<a class="course" href="/course/{course.id}">
				<span class="side" class:black={course.side === 'b'}></span>
				<span class="t"><b>{course.name}</b><span>{n} of {course.lines.length} lines</span></span>
				<div class="progress mini"><i style:width="{(100 * n) / course.lines.length}%"></i></div>
			</a>
		{/each}
	</div>

	<h2 class="label section">Settings</h2>
	<div class="card list">
		<div class="setting">
			<span class="t"><b>Sound</b><span>Move and feedback sounds</span></span>
			<button class="switch" role="switch" aria-checked={!muted} aria-label="Sound" onclick={toggleSound}><i></i></button>
		</div>
		<div class="setting">
			<span class="t"><b>Reset progress</b><span>Deletes learned lines, reviews and streaks on this device</span></span>
			{#if confirming}
				<span class="confirm">
					<button class="btn sm btn-surface" onclick={() => (confirming = false)}>Cancel</button>
					<button class="btn sm danger" onclick={reset}>Delete</button>
				</span>
			{:else}
				<button class="btn sm btn-surface" onclick={() => (confirming = true)}>Reset</button>
			{/if}
		</div>
	</div>

	<p class="about">Chessmode is free and open source (GPL-3.0). Progress stays on this device.</p>
</main>

<style>
	.hero {
		padding: 22px 0 10px;
		display: grid;
		justify-items: center;
		text-align: center;
		background: radial-gradient(70% 60% at 50% 30%, rgba(255, 107, 44, 0.22), transparent 70%);
	}
	.hero img {
		width: 150px;
		height: 150px;
		object-fit: contain;
		filter: drop-shadow(0 20px 30px rgba(255, 107, 44, 0.3));
	}
	.big {
		font-size: 64px;
		font-weight: 600;
		letter-spacing: -0.05em;
		line-height: 1;
		margin-top: 4px;
	}
	.hero .h-head {
		margin-top: 4px;
	}
	.hero .muted {
		font-size: 14px;
		margin-top: 4px;
	}
	.month {
		padding: 16px;
		margin-top: 18px;
	}
	.month-head {
		display: flex;
		justify-content: space-between;
		font-size: 14px;
	}
	.cal {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 6px;
		margin-top: 12px;
	}
	.dow {
		text-align: center;
		font-size: 11px;
		color: var(--text-3);
	}
	.cal i {
		aspect-ratio: 1;
		border-radius: 9px;
		background: var(--surface-3);
		display: grid;
		place-items: center;
		font-size: 11px;
		font-style: normal;
		color: var(--text-3);
	}
	.cal i.on {
		background: var(--g-accent);
		color: #fff;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 2px 0 var(--accent-lip);
	}
	.cal i.today {
		box-shadow: inset 0 0 0 1.5px var(--accent);
		color: var(--text);
	}
	.cal i.on.today {
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4), 0 2px 0 var(--accent-lip), 0 0 0 2px var(--bg), 0 0 0 3.5px var(--accent);
	}
	.tiles {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-top: 12px;
	}
	.tile {
		padding: 12px;
		display: grid;
		gap: 2px;
	}
	.tile span {
		font-size: 12px;
		color: var(--text-3);
	}
	.tile b {
		font-size: 22px;
		font-weight: 600;
		letter-spacing: -0.03em;
	}
	.section {
		margin: 26px 0 10px;
		text-transform: uppercase;
	}
	.list {
		padding: 2px 16px;
	}
	.course,
	.setting {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 0;
		border-top: 1px solid var(--stroke);
		position: relative;
	}
	.course:first-child,
	.setting:first-child {
		border-top: 0;
	}
	.t {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.t b {
		font-weight: 500;
	}
	.t span {
		font-size: 13px;
		color: var(--text-3);
	}
	.side {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #f4f4f2;
		flex: 0 0 auto;
	}
	.side.black {
		background: #111;
		box-shadow: 0 0 0 1.5px #666;
	}
	.progress.mini {
		width: 80px;
		height: 6px;
	}
	.switch {
		width: 50px;
		height: 30px;
		border-radius: 999px;
		background: var(--surface-4);
		position: relative;
		transition: background 0.2s;
		flex: 0 0 auto;
	}
	.switch i {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
		transition: transform 0.2s var(--ease-out);
	}
	.switch[aria-checked='true'] {
		background: var(--accent);
	}
	.switch[aria-checked='true'] i {
		transform: translateX(20px);
	}
	.confirm {
		display: flex;
		gap: 6px;
	}
	.danger {
		background: var(--bad);
		color: #fff;
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3), 0 2px 0 #a3302a;
	}
	.about {
		margin-top: 24px;
		text-align: center;
		font-size: 12px;
		color: var(--text-3);
	}
</style>
