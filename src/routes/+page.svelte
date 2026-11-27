<script lang="ts">
	import { ChevronDown, ChevronRight, Plus } from '@lucide/svelte';
	import { scale } from 'svelte/transition';
	import { easeOut, reducedMotion } from '#lib/motion.ts';
	import { onMount, tick } from 'svelte';
	import { courses } from '#lib/courses/index.ts';
	import type { Course, LineKey } from '#lib/courses/types.ts';
	import { db, type LineProgress } from '#lib/db.ts';
	import MiniBoard from '#lib/components/MiniBoard.svelte';
	import InstallSuggestion from '#lib/components/InstallSuggestion.svelte';
	import { activeCourse, loadProgress, setActiveCourse, loadDepth, loadLibrary, removeFromLibrary } from '#lib/train/data.ts';
	import { courseScope, defaultDepth, type DepthChoice } from '#lib/courses/depth.ts';
	import { normalizeDepth, resumeHref } from '#lib/courses/scope.ts';
	import { courseStats, lineEnd, lineStatus, lineTail } from '#lib/train/stats.ts';
	import { streak } from '#lib/progress.ts';
	import { dismissOnboarding, readOnboarding } from '#lib/onboarding/store.ts';

	let course = $state.raw<Course>();
	let choice = $state(defaultDepth());
	let library = $state<string[]>([]);
	let depths = $state<Record<string, DepthChoice>>({});
	let progress = $state.raw(new Map<LineKey, LineProgress>());
	let days = $state<string[]>([]);
	let switcher = $state(false);
	let loaded = $state(false);
	let offerSetup = $state(false);
	const now = Date.now();

	onMount(() => {
		const onDepth = async (event: Event) => {
			const id = (event as CustomEvent<string>).detail;
			const next = await loadDepth(id);
			depths = { ...depths, [id]: next };
			if (course?.id === id) choice = next;
		};
		window.addEventListener('depth-change', onDepth);
		void (async () => {
			[course, progress, days] = await Promise.all([activeCourse(), loadProgress(), db.sessions.toArray().then((s) => s.map((x) => x.day))]);
			library = await loadLibrary();
			const saved: Record<string, DepthChoice> = {};
			for (const row of await db.settings.toArray()) {
				if (row.key.startsWith('depth/')) saved[row.key.slice('depth/'.length)] = normalizeDepth(row.value as Partial<DepthChoice>);
			}
			depths = saved;
			if (course) choice = depths[course.id] ?? (await loadDepth(course.id));
			offerSetup = (await readOnboarding()).status === 'pending';
			loaded = true;
			await tick();
			if (!offerSetup) document.querySelector('[data-active-node]')?.scrollIntoView({ block: 'center' });
		})();
		return () => window.removeEventListener('depth-change', onDepth);
	});

	async function skipSetup() {
		await dismissOnboarding();
		offerSetup = false;
	}

	async function choose(c: Course) {
		course = c;
		switcher = false;
		await setActiveCourse(c.id);
		choice = await loadDepth(c.id);
		await tick();
		document.querySelector('[data-active-node]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}

	const scope = $derived(course ? courseScope(course, choice, progress) : undefined);
	const stats = $derived(course && scope ? courseStats({ ...course, lines: scope.lines }, progress, now) : undefined);
	async function removeLibrary(id: string) { await removeFromLibrary(id); library = await loadLibrary(); }
	const streakDays = $derived(streak(days));
	/** Horizontal position of the n-th node on the winding path, -1..1. */
	const sway = (n: number) => Math.sin(n * 1.15);
	const libraryCourses = $derived(courses.filter((c) => library.includes(c.id)));
	const nextChapter = $derived(course?.chapters.find((c) => c.id === stats?.next?.chapterId));
	const nextIndex = $derived(nextChapter && stats?.next ? nextChapter.lines.findIndex((l) => l.key === stats.next?.key) + 1 : 0);
</script>

<svelte:head><title>Chessmode</title></svelte:head>

<main class="page home">
	<div class="home-content">
	<header class="top">
		<button class="switch" onclick={() => (switcher = !switcher)} aria-expanded={switcher} aria-haspopup="listbox">
			<span class="side" class:black={course?.side === 'b'}></span>
			<span class="name">{course?.name ?? 'Choose a course'}</span>
			<ChevronDown size={18} stroke-width={1.75} />
		</button>
		<a class="streak" href="/you" aria-label="{streakDays} day streak">
			<img src="/img/flame.webp" alt="" />
			<b>{streakDays}</b>
		</a>
		{#if switcher}
			<div class="menu card" role="listbox" aria-label="Courses" transition:scale={{ start: 0.96, duration: reducedMotion() ? 0 : 180, easing: easeOut }}>
				{#each courses as c (c.id)}
					{@const s = courseStats(c, progress, now)}
					<button role="option" aria-selected={c.id === course?.id} class:on={c.id === course?.id} onclick={() => choose(c)}>
						{#if c.id.startsWith('custom-')}<span class="side" class:black={c.side === 'b'}></span>{:else}<img class="course-art" src="/img/courses/{c.id}.webp" alt="" />{/if}
						<span class="t"><b>{c.name}</b><small>{c.side === 'w' ? 'White' : 'Black'} · {s.learned}/{s.total} learned</small></span>
						{#if s.due}<span class="chip accent">{s.due} due</span>{/if}
					</button>
				{/each}
				<a class="all" href="/courses"><Plus size={18} stroke-width={1.75} /> Browse all courses</a>
			</div>
		{/if}
	</header>

	<InstallSuggestion />

	{#if loaded && offerSetup}
		<section class="card setup mobile-setup">
			<img class="suggest-art" src="/img/onboarding/suggest.webp" alt="" />
			<p class="h-head">Want a course suggested?</p>
			<p class="muted">Optional. Your rating picks a starting point. You can train without it.</p>
			<div class="setup-actions">
				<a class="btn sm btn-primary" href="/onboarding">Set up</a>
				<button class="btn sm btn-surface" type="button" onclick={skipSetup}>Not now</button>
			</div>
		</section>
	{/if}

	{#if loaded}
		<section class="library">
			<h2 class="h-head">Your library</h2>
			{#each libraryCourses as c (c.id)}
				{@const depth = depths[c.id] ?? defaultDepth()}
				{@const scoped = courseScope(c, depth, progress)}
				{@const sample = scoped.lines[0] ?? c.lines[0]}
				<div class="card library-row">
					<a href={resumeHref(c, depth, progress, now)}>
						{#if c.id.startsWith('custom-')}<MiniBoard fen={lineEnd(sample)} orientation={c.side === 'w' ? 'white' : 'black'} size={52} />{:else}<img class="course-art" src="/img/courses/{c.id}.webp" alt="" />{/if}
						<span class="t">
							<b>{c.name}</b>
							<small>{c.side === 'w' ? 'White' : 'Black'} · {lineTail(sample, 3)} · {scoped.learned}/{scoped.total} learned · {scoped.perfected} perfected</small>
						</span>
					</a>
					<button class="chip" onclick={() => removeLibrary(c.id)} aria-label="Remove {c.name} from library">Remove</button>
				</div>
			{/each}
			<a class="card library-row browse" href="/courses">
				<span class="browse-icon"><Plus size={22} stroke-width={1.75} /></span>
				<span class="t">
					<b>Browse courses</b>
					<small>{courses.length} openings for White and Black</small>
				</span>
				<ChevronRight size={20} stroke-width={1.75} />
			</a>
		</section>
	{/if}
	{#if course && loaded && stats && scope}
		<a class="overview card" href="/course/{course.id}">
			<div>
				<p class="label">{course.side === 'w' ? 'White' : 'Black'} repertoire</p>
				<h1 class="h-title">{course.name}</h1>
				<div class="bar"><div class="progress"><i style:width="{(100 * stats.learned) / stats.total}%"></i></div><span>{stats.learned}/{stats.total}</span></div>
			</div>
			<ChevronRight size={20} stroke-width={1.75} />
		</a>

		{#each course.chapters.filter(c => c.lines.some(l => scope.lines.includes(l))) as chapter, ci (chapter.id)}
			{@const learned = chapter.lines.filter((l) => progress.has(l.key)).length}
			<section class="chapter">
				<div class="module">
					<span class="num">{ci + 1}</span>
					<div class="t">
						<b>{chapter.name}</b>
						<small>{chapter.moves ? `${chapter.moves} · ` : ''}{learned}/{chapter.lines.length} learned</small>
					</div>
					{#if chapter.quiz.length}
						<a class="chip" href="/quiz/{course.id}/{chapter.id}">Quiz</a>
					{/if}
				</div>

				<ol class="path">
					{#each chapter.lines.filter(l => scope.lines.includes(l)) as line, li (line.key)}
						{@const n = ci * 3 + li}
						{@const st = lineStatus(progress, line.key, now)}
						{@const active = stats.next?.key === line.key}
						{@const kind = active ? 'active' : st.kind === 'new' ? 'locked' : 'done'}
						<li class="step {kind}" style:--s={sway(n)} style:--p={li === 0 ? sway(n) : sway(n - 1)}>
							{#if li > 0}
								<span class="trail" aria-hidden="true"><i></i><i></i><i></i></span>
							{/if}
							<a
								class="node"
								href={kind === 'done' ? `/practice/run?line=${encodeURIComponent(line.key)}` : `/learn/${course.id}/${line.id}`}
								data-active-node={active ? '' : undefined}
								aria-label="{line.name}: {kind === 'done' ? (st.kind === 'due' ? 'due for practice' : 'learned') : active ? 'next line' : 'not learned yet'}"
							>
								{#if active}<span class="glow"></span>{/if}
								<img src="/img/node-{kind}.webp" alt="" />
								{#if st.kind === 'due'}<span class="due-dot"></span>{/if}
							</a>
							<span class="cap">{line.name}</span>
						</li>
					{/each}
				</ol>
			</section>
		{/each}

	{/if}
	</div>
	<aside class="home-aside">
	{#if course && loaded && stats && scope}
		<div class="cta">
			<div class="top-row">
				<div>
					{#if stats.due}
						<b>{stats.due} {stats.due === 1 ? 'line' : 'lines'} due</b>
						<span>Keep them fresh before learning more.</span>
					{:else if stats.next}
						<b>{stats.next.name}</b>
						<span>{nextChapter?.name} · line {nextIndex} of {nextChapter?.lines.length}</span>
					{:else}
						<b>Course complete</b>
						<span>Keep it sharp in Practice and Drill.</span>
					{/if}
				</div>
				<div class="ring" style:--p={stats.learned / stats.total}></div>
			</div>
			{#if stats.due}
				<a class="btn btn-white block" href="/practice/run?course={course.id}">Practice {stats.due} due</a>
			{:else if stats.next}
				<a class="btn btn-white block" href={resumeHref(course, choice, progress, now)}>{stats.learned ? 'Continue' : 'Start'} learning</a>
			{:else}
				<a class="btn btn-white block" href="/drill">Go to Drill</a>
			{/if}
		</div>
	{/if}
	{#if loaded && offerSetup}
		<section class="card setup desktop-setup">
			<img class="suggest-art" src="/img/onboarding/suggest.webp" alt="" />
			<p class="h-head">Want a course suggested?</p>
			<p class="muted">Optional. Your rating picks a starting point. You can train without it.</p>
			<div class="setup-actions">
				<a class="btn sm btn-primary" href="/onboarding">Set up</a>
				<button class="btn sm btn-surface" type="button" onclick={skipSetup}>Not now</button>
			</div>
		</section>
	{/if}
	</aside>
</main>

<style>
	.course-art { width: 52px; height: 52px; object-fit: contain; flex: none; }
	.suggest-art { width: 80px; height: 80px; object-fit: contain; float: right; }
	.setup {
		display: grid;
		gap: 8px;
		padding: 16px;
		margin: 4px 0 8px;
	}
	.setup-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-top: 4px;
	}
	.library {
		display: grid;
		gap: 8px;
		margin: 12px 0 20px;
	}
	.library-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 12px;
	}
	.browse {
		min-height: 78px;
		border-style: dashed;
		border-color: var(--stroke-2);
		color: var(--text-2);
	}
	.browse .t {
		flex: 1;
	}
	.browse b {
		color: var(--text);
	}
	.browse-icon {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		flex: 0 0 auto;
		border-radius: 12px;
		background: var(--surface-3);
	}
	.library-row a {
		display: flex;
		align-items: center;
		gap: 12px;
		flex: 1;
		min-width: 0;
	}
	.library-row .t {
		display: grid;
		min-width: 0;
	}
	.library-row .t small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.library-row small {
		color: var(--text-3);
	}
	.home {
		padding-bottom: calc(var(--tabbar-h) + 200px + var(--safe-bottom));
	}
	.top {
		position: sticky;
		top: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 14px 0 12px;
		background: var(--bg);
		box-shadow: 0 10px 14px -4px var(--bg);
	}
	.switch {
		display: flex;
		align-items: center;
		gap: 10px;
		height: 44px;
		padding: 0 14px 0 12px;
		border-radius: var(--r-pill);
		background: var(--g-surface);
		border: 1px solid var(--stroke);
		box-shadow: var(--d-surface);
		font-weight: 600;
		font-size: 15px;
		min-width: 0;
	}
	.switch .name {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.side {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: #f4f4f2;
		box-shadow: 0 0 0 2px var(--surface-4);
		flex: 0 0 auto;
	}
	.side.black {
		background: #111;
		box-shadow: 0 0 0 2px #555;
	}
	.streak {
		margin-left: auto;
		display: flex;
		align-items: center;
		gap: 2px;
		height: 44px;
		padding: 0 14px 0 8px;
		border-radius: var(--r-pill);
		background: var(--g-surface);
		border: 1px solid var(--stroke);
		box-shadow: var(--d-surface);
		font-weight: 600;
	}
	.streak img {
		width: 28px;
		height: 28px;
		object-fit: contain;
	}
	.menu {
		position: absolute;
		top: 62px;
		left: 0;
		width: min(100%, 360px);
		padding: 6px;
		display: grid;
		background: var(--surface-3);
		box-shadow: var(--d-raised);
		transform-origin: top left;
		max-height: min(440px, calc(100dvh - 200px));
		overflow-y: auto;
		overscroll-behavior: contain;
		z-index: 20;
	}
	.menu button {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-radius: 12px;
		text-align: left;
	}
	.menu button.on {
		background: var(--surface-4);
	}
	@media (hover: hover) and (pointer: fine) {
		.menu button:hover {
			background: var(--surface-4);
		}
	}
	.menu .t {
		flex: 1;
		display: grid;
	}
	.menu small {
		color: var(--text-3);
		font-size: 12px;
	}
	.menu .all {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		border-radius: 12px;
		font-size: 13px;
		color: var(--text-2);
	}
	.overview {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 18px;
		margin-top: 4px;
	}
	.overview > div {
		flex: 1;
		display: grid;
		gap: 2px;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 8px;
	}
	.bar .progress {
		flex: 1;
		height: 6px;
	}
	.bar span {
		font: 600 12px var(--mono);
		color: var(--text-2);
	}
	.chapter {
		margin-top: 28px;
	}
	.module {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 14px;
		border-radius: var(--r-lg);
		background: var(--surface-1);
		border: 1px solid var(--stroke);
	}
	.num {
		width: 30px;
		height: 30px;
		border-radius: 10px;
		display: grid;
		place-items: center;
		font: 600 13px var(--mono);
		background: var(--surface-3);
		color: var(--text-2);
	}
	.module .t {
		flex: 1;
		display: grid;
		min-width: 0;
	}
	.module b {
		font-weight: 600;
	}
	.module small {
		font-size: 12px;
		color: var(--text-3);
	}
	.path {
		list-style: none;
		margin: 0;
		padding: 18px 0 0;
		display: grid;
		justify-items: center;
	}
	.step {
		--reach: min(26vw, 120px);
		position: relative;
		display: grid;
		justify-items: center;
		width: 150px;
		translate: calc(var(--s) * var(--reach)) 0;
		padding-top: 30px;
	}
	.step:first-child {
		padding-top: 0;
	}
	.trail {
		position: absolute;
		top: 0;
		left: 50%;
		width: 0;
		height: 30px;
	}
	.trail i {
		position: absolute;
		width: 6px;
		height: 6px;
		margin-left: -3px;
		border-radius: 50%;
		background: var(--surface-4);
	}
	.trail i:nth-child(1) {
		top: 2px;
		left: calc((var(--p) - var(--s)) * var(--reach) * 0.75);
	}
	.trail i:nth-child(2) {
		top: 12px;
		left: calc((var(--p) - var(--s)) * var(--reach) * 0.5);
	}
	.trail i:nth-child(3) {
		top: 22px;
		left: calc((var(--p) - var(--s)) * var(--reach) * 0.25);
	}
	.done .trail i,
	.active .trail i {
		background: rgba(255, 107, 44, 0.55);
	}
	.node {
		position: relative;
		display: block;
		width: 82px;
		height: 82px;
		transition: transform var(--dur-press) var(--ease-out);
	}
	.node:active {
		transform: translateY(2px) scale(0.98);
	}
	.node img {
		position: relative;
		width: 100%;
		height: 100%;
		object-fit: contain;
		filter: drop-shadow(0 10px 12px rgba(0, 0, 0, 0.55));
	}
	.locked .node {
		width: 72px;
		height: 72px;
		opacity: 0.85;
	}
	.active .node {
		width: 132px;
		height: 132px;
	}
	.glow {
		position: absolute;
		inset: -50%;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(255, 107, 44, 0.36), transparent 62%);
		animation: breathe 2.6s ease-in-out infinite;
	}
	@keyframes breathe {
		50% {
			opacity: 0.6;
			transform: scale(0.94);
		}
	}
	.due-dot {
		position: absolute;
		top: 8px;
		right: 6px;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 0 0 3px var(--bg), 0 0 12px rgba(255, 107, 44, 0.8);
	}
	.cap {
		margin-top: 4px;
		max-width: 150px;
		text-align: center;
		font-size: 12px;
		line-height: 1.3;
		color: var(--text-3);
	}
	.done .cap {
		color: var(--text-2);
	}
	.active .cap {
		color: var(--text);
		font-weight: 600;
		font-size: 13px;
	}
	.cta {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		bottom: calc(var(--tabbar-h) + 26px + var(--safe-bottom));
		width: min(calc(100% - 24px), 520px);
		padding: 16px;
		border-radius: 26px;
		background: var(--g-accent);
		box-shadow:
			inset 0 1px 0 rgba(255, 255, 255, 0.4),
			0 3px 0 var(--accent-lip),
			0 30px 50px -20px rgba(255, 107, 44, 0.6);
		z-index: 30;
	}
	.top-row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		align-items: center;
		margin-bottom: 14px;
	}
	.top-row b {
		display: block;
		font-size: 17px;
		font-weight: 600;
		letter-spacing: -0.015em;
	}
	.top-row span {
		font-size: 14px;
		opacity: 0.88;
	}
	.ring {
		--p: 0;
		width: 40px;
		height: 40px;
		flex: 0 0 auto;
		border-radius: 50%;
		background: conic-gradient(#fff calc(var(--p) * 360deg), rgba(255, 255, 255, 0.3) 0);
		-webkit-mask: radial-gradient(circle, transparent 14px, #000 15px);
		mask: radial-gradient(circle, transparent 14px, #000 15px);
	}
	.home-aside {
		display: contents;
	}
	.desktop-setup {
		display: none;
	}
	@media (min-width: 1024px) {
		.home-aside {
			display: grid;
			position: sticky;
			top: 92px;
			gap: 16px;
		}
		.mobile-setup {
			display: none;
		}
		.desktop-setup {
			display: grid;
		}
		.home {
			display: grid;
			grid-template-columns: minmax(0, 1fr) 360px;
			gap: 40px;
			align-items: start;
			padding-bottom: 48px;
		}
		.top {
			position: relative;
		}
		.streak {
			display: none;
		}
		.cta {
			position: relative;
			top: auto;
			bottom: auto;
			left: auto;
			transform: none;
			width: 100%;
			margin-top: 24px;
		}
	}
</style>
