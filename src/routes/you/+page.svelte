<script lang="ts">
	import { onMount } from 'svelte';
	import { courses } from '#lib/courses/index.ts';
	import { dayKey, db, type LineProgress, type SessionLog } from '#lib/db.ts';
	import { streak } from '#lib/progress.ts';
	import { totalXp } from '#lib/train/stats.ts';
	import { isMuted, setMuted } from '#lib/sound.ts';
	import { bestAllTime, longestStreak, personalRecords, profileActivity, yearHeatmap } from '#lib/activity/activity.ts';
	import type { RecordLine } from '#lib/activity/types.ts';
	import { parseArchive, serializeArchive } from '#lib/archive/archive.ts';
	import { readArchive, replaceWithArchive } from '#lib/archive/io.ts';
	import { readOnboarding } from '#lib/onboarding/store.ts';
	import { RATING_BRACKETS, type OnboardingProfile } from '#lib/onboarding/types.ts';
	import Heatmap from '#lib/components/activity/Heatmap.svelte';
	import Switch from '#lib/components/Switch.svelte';

	let sessions = $state<SessionLog[]>([]);
	let progress = $state<LineProgress[]>([]);
	let muted = $state(isMuted());
	let confirming = $state(false);
	let loaded = $state(false);
	let setup = $state<OnboardingProfile | null>(null);
	let backupError = $state('');
	let pendingText = $state<string | null>(null);
	let pendingWhen = $state('');
	let importing = $state(false);
	let fileInput = $state<HTMLInputElement>();

	const today = new Date();

	onMount(async () => {
		[sessions, progress, setup] = await Promise.all([db.sessions.toArray(), db.progress.toArray(), readOnboarding()]);
		loaded = true;
	});

	const activity = $derived(
		profileActivity(
			courses.map((course) => ({
				id: course.id,
				name: course.name,
				side: course.side,
				lineKeys: course.lines.map((line) => line.key)
			})),
			progress
		)
	);
	const heat = $derived(yearHeatmap(sessions, today));
	const records = $derived(personalRecords(sessions, today));
	const current = $derived(streak(sessions.map((session) => session.day)));
	const longest = $derived(longestStreak(sessions.map((session) => session.day)));
	const reviews = $derived(progress.reduce((sum, row) => sum + row.reviews, 0));
	const drillBest = $derived(bestAllTime(records, 'drill'));
	const timeLines = $derived(bestAllTime(records, 'time', 'lines'));
	const timeMoves = $derived(bestAllTime(records, 'time', 'moves'));
	const recordGroups = $derived.by(() => {
		const groups = new Map<string, RecordLine[]>();
		for (const row of records) {
			const list = groups.get(row.courseId) ?? [];
			list.push(row);
			groups.set(row.courseId, list);
		}
		return [...groups];
	});

	function courseName(id: string): string {
		return activity.courses.find((course) => course.id === id)?.name ?? id;
	}

	function recordLabel(row: RecordLine): string {
		if (row.mode === 'drill') return 'Drill';
		return row.metric === 'moves' ? 'Move points' : 'Line score';
	}

	function show(score: number | null): string {
		return score === null ? '–' : String(score);
	}

	function setupDetail(profile: OnboardingProfile | null): string {
		if (!profile || profile.status !== 'completed') return 'Optional. Suggests a course from your rating.';
		const bracket = RATING_BRACKETS.find((item) => item.id === profile.bracket);
		return bracket ? `Rating saved: ${bracket.label}` : 'Rating saved';
	}

	async function toggleSound(soundOn: boolean) {
		muted = !soundOn;
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

	async function exportBackup() {
		backupError = '';
		const archive = await readArchive();
		const blob = new Blob([serializeArchive(archive)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `chessmode-${dayKey(archive.exportedAt)}.json`;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function chooseBackup(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		pendingText = null;
		if (!file) return;
		const text = await file.text();
		const parsed = parseArchive(text);
		if (!parsed.ok) {
			backupError = parsed.error;
			return;
		}
		backupError = '';
		pendingText = text;
		pendingWhen = new Date(parsed.archive.exportedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
	}

	async function confirmImport() {
		if (!pendingText || importing) return;
		importing = true;
		backupError = '';
		try {
			const parsed = parseArchive(pendingText);
			if (!parsed.ok) throw new Error(parsed.error);
			await replaceWithArchive(parsed.archive);
			location.reload();
		} catch (error) {
			console.error(error);
			importing = false;
			backupError = 'Could not import this backup. Nothing was changed.';
		}
	}
</script>

<svelte:head><title>You · Chessmode</title></svelte:head>

<main class="page profile">
	<div>
	<section class="hero">
		<img src="/img/flame.webp" alt="" />
		<div class="big">{current}</div>
		<p class="h-head">day streak</p>
		<p class="muted">{current ? 'Train today to keep it going.' : 'Finish any session to start a streak.'}</p>
	</section>

	{#if loaded}
		<div class="tiles">
			<div class="card tile"><span>Total XP</span><b>{totalXp(sessions)}</b></div>
			<div class="card tile"><span>Lines discovered</span><b>{activity.discovered}</b></div>
			<div class="card tile"><span>Openings perfected</span><b>{activity.openingsPerfected}</b></div>
			<div class="card tile"><span>Reviews</span><b>{reviews}</b></div>
			<div class="card tile"><span>Best drill</span><b>{show(drillBest)}</b></div>
			<div class="card tile"><span>{timeMoves === null ? 'Best time' : 'Time · lines'}</span><b>{show(timeLines)}</b></div>
			{#if timeMoves !== null}<div class="card tile"><span>Time · moves</span><b>{timeMoves}</b></div>{/if}
			<div class="card tile"><span>Sessions</span><b>{sessions.length}</b></div>
		</div>

		<h2 class="label section">Activity</h2>
		<div class="card year">
			<div class="year-head">
				<b>Past year</b>
				<span class="muted">Best streak {longest} {longest === 1 ? 'day' : 'days'}</span>
			</div>
			<Heatmap days={heat} />
		</div>

		<h2 class="label section">Records</h2>
		{#if recordGroups.length === 0}
			<p class="muted empty">Finish a Drill or Time run to set a record.</p>
		{:else}
			<div class="card list">
				{#each recordGroups as [courseId, lines] (courseId)}
					<div class="record">
						<b>{courseName(courseId)}</b>
						<div class="record-head" aria-hidden="true"><span></span><span>Today</span><span>Week</span><span>Month</span><span>All</span></div>
						{#each lines as line (`${line.mode}-${line.metric}`)}
							<div class="record-row">
								<span>{recordLabel(line)}</span>
								<span class="num">{show(line.day)}</span>
								<span class="num">{show(line.week)}</span>
								<span class="num">{show(line.month)}</span>
								<span class="num">{show(line.all)}</span>
							</div>
						{/each}
					</div>
				{/each}
			</div>
		{/if}

		<h2 class="label section">Courses</h2>
		<div class="card list">
			{#each activity.courses as course (course.id)}
				<a class="course" href="/course/{course.id}">
					<span class="side" class:black={course.side === 'b'}></span>
					<span class="t">
						<b>{course.name}</b>
						<span>{course.discovered} discovered · {course.perfected} perfected</span>
					</span>
					{#if course.perfectedCourse}<span class="chip accent">Perfected</span>{/if}
					<div class="progress mini" aria-hidden="true"><i style:width="{course.total ? (100 * course.discovered) / course.total : 0}%"></i></div>
				</a>
			{/each}
		</div>
	{/if}

	</div>
	<div>
	<h2 class="label section">Settings</h2>
	<div class="card list">
		<a class="setting" href="/onboarding">
			<span class="t"><b>Training setup</b><span>{setupDetail(setup)}</span></span>
		</a>
		<div class="setting">
			<span class="t"><b>Sound</b><span>Move and feedback sounds</span></span>
			<Switch checked={!muted} label="Sound" onchange={toggleSound} />
		</div>
		<div class="setting">
			<span class="t"><b>Backup</b><span>One file with progress, settings, courses and reviews</span></span>
			<span class="confirm">
				<button class="btn sm btn-surface" type="button" onclick={exportBackup}>Export</button>
				<button class="btn sm btn-surface" type="button" onclick={() => fileInput?.click()}>Import</button>
			</span>
			<input bind:this={fileInput} class="file" type="file" accept="application/json,.json" onchange={chooseBackup} />
		</div>
		{#if backupError}<p class="backup-error">{backupError}</p>{/if}
		{#if pendingText}
			<div class="import">
				<p>Replace everything on this device with the backup from {pendingWhen}?</p>
				<span class="confirm">
					<button class="btn sm btn-surface" type="button" disabled={importing} onclick={() => (pendingText = null)}>Cancel</button>
					<button class="btn sm btn-primary" type="button" disabled={importing} onclick={confirmImport}>{importing ? 'Importing…' : 'Replace'}</button>
				</span>
			</div>
		{/if}
		<div class="setting">
			<span class="t"><b>Reset progress</b><span>Deletes learned lines, reviews and streaks on this device</span></span>
			{#if confirming}
				<span class="confirm">
					<button class="btn sm btn-surface" type="button" onclick={() => (confirming = false)}>Cancel</button>
					<button class="btn sm danger" type="button" onclick={reset}>Delete</button>
				</span>
			{:else}
				<button class="btn sm btn-surface" type="button" onclick={() => (confirming = true)}>Reset</button>
			{/if}
		</div>
	</div>

	<p class="about">Chessmode is free and open source (GPL-3.0). Progress stays on this device until you export it.</p>
	</div>
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
		letter-spacing: -0.04em;
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
	.tiles {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		margin-top: 18px;
	}
	.tile:last-child:nth-child(odd) {
		grid-column: 1 / -1;
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
		font-variant-numeric: tabular-nums;
	}
	.section {
		margin: 26px 0 10px;
		text-transform: uppercase;
	}
	.year {
		padding: 16px;
		display: grid;
		gap: 12px;
	}
	.year-head {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		font-size: 14px;
	}
	.empty {
		font-size: 14px;
	}
	.list {
		padding: 2px 16px;
	}
	.record {
		display: grid;
		gap: 6px;
		padding: 14px 0;
		border-top: 1px solid var(--stroke);
	}
	.record:first-child {
		border-top: 0;
	}
	.record-head,
	.record-row {
		display: grid;
		grid-template-columns: minmax(72px, 1.3fr) repeat(4, minmax(32px, 1fr));
		gap: 6px;
		align-items: baseline;
	}
	.record-head {
		font-size: 11px;
		color: var(--text-3);
		text-align: right;
	}
	.record-head span:first-child,
	.record-row span:first-child {
		text-align: left;
	}
	.record-row {
		font-size: 14px;
	}
	.num {
		text-align: right;
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
	.course,
	.setting {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
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
		width: 64px;
		height: 6px;
	}
	.confirm {
		display: flex;
		gap: 6px;
		flex: 0 0 auto;
	}
	.file {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
	}
	.import {
		display: grid;
		gap: 10px;
		padding: 0 0 14px;
		font-size: 14px;
	}
	.backup-error {
		color: var(--bad);
		font-size: 13px;
		padding-bottom: 12px;
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
	@media (min-width: 900px) {
		main.page {
			max-width: 720px;
		}
		.tiles {
			grid-template-columns: repeat(4, minmax(0, 1fr));
		}
		.tile:last-child:nth-child(odd) {
			grid-column: auto;
		}
	}
	@media (min-width: 1024px) {
		main.page {
			max-width: 1200px;
		}
		.profile {
			display: grid;
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			gap: 32px;
		}
	}
</style>
