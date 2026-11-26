<script lang="ts">
	import { ChevronDown, ChevronLeft, ChevronRight, Trash2 } from '@lucide/svelte';
	import { slide } from 'svelte/transition';
	import { easeOut, reducedMotion } from '#lib/motion.ts';
	import { seg } from '#lib/components/seg.ts';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { deleteCustomCourse, isCustom } from '#lib/courses/custom.ts';
	import { getCourse } from '#lib/courses/index.ts';
	import { courseIntro } from '#lib/courses/intro.ts';
	import type { LineKey } from '#lib/courses/types.ts';
	import { setSetting, type LineProgress } from '#lib/db.ts';
	import MiniBoard from '#lib/components/MiniBoard.svelte';
	import CourseIntro from '#lib/components/courses/CourseIntro.svelte';
	import DepthChooser from '#lib/components/DepthChooser.svelte';
	import { loadProgress, setActiveCourse, loadDepth, saveDepth, addToLibrary } from '#lib/train/data.ts';
	import { courseScope, defaultDepth } from '#lib/courses/depth.ts';
	import { modeAvailability, modeData, type CourseMode } from '#lib/courses/unlocks.ts';
	import { courseStats, lineEnd, lineStatus, lineTail, relativeTime } from '#lib/train/stats.ts';
	import { courseCoverage, type Coverage } from '#lib/explorer/coverage.ts';
	import { loadExplorer } from '#lib/explorer/types.ts';

	const course = $derived(getCourse(page.params.id));
	let choice = $state(defaultDepth());
	let previewTier = $state(0);
	let chooser = $state(false);
	let progress = $state.raw(new Map<LineKey, LineProgress>());
	let tab = $state<'lines' | 'ideas' | 'quiz'>('lines');
	let open = $state<string | undefined>();
	let coverage = $state.raw<Coverage>();
	let gapsOpen = $state(false);
	let sample = $state(0);
	let aboutId = $state<string | undefined>();
	const now = Date.now();
	const opening = $derived(course ? courseIntro(course.id) : undefined);

	onMount(() => {
		const onDepth = async (event: Event) => {
			const id = (event as CustomEvent<string>).detail;
			if (course && id === course.id) choice = await loadDepth(course.id);
		};
		window.addEventListener('depth-change', onDepth);
		void (async () => {
			progress = await loadProgress();
			if (!course) return;
			await setActiveCourse(course.id);
			await addToLibrary(course.id);
			choice = await loadDepth(course.id);
			previewTier = choice.tier;
			chooser = !choice.seen && courseScope(course, choice, progress).tiers.length > 1;
			const explorer = isCustom(course.id) ? undefined : await loadExplorer(course.id);
			if (explorer) {
				coverage = courseCoverage(course, explorer);
				sample = explorer.games;
			}
		})();
		return () => window.removeEventListener('depth-change', onDepth);
	});

	const scope = $derived(course ? courseScope(course, choice, progress) : undefined);
	const stats = $derived(course && scope ? courseStats({ ...course, lines: scope.lines }, progress, now) : undefined);
	async function closeChooser(confirm: boolean) {
		if (!course) return;
		choice = { ...choice, seen: true, tier: confirm ? previewTier : choice.tier };
		await saveDepth(course.id, $state.snapshot(choice));
		chooser = false;
	}
	const orientation = $derived(course?.side === 'w' ? 'white' : 'black');
	const reveal = { duration: reducedMotion() ? 0 : 220, easing: easeOut };
	const hasQuiz = $derived(course?.chapters.some((c) => c.quiz.length) ?? false);

	async function remove() {
		if (!course || !confirm(`Delete “${course.name}” and its progress?`)) return;
		await deleteCustomCourse(course.id);
		await goto('/courses');
	}

	const minutes = $derived(course ? Math.round(course.lines.reduce((s, l) => s + l.plies.filter((p) => p.student).length, 0) * 0.25) : 0);

	async function closeAbout() {
		if (course) await setSetting(`intro/${course.id}`, true);
		aboutId = undefined;
	}

	async function startFromAbout() {
		if (!course) return;
		const id = scope?.next?.id ?? course.lines[0]?.id;
		await setSetting(`intro/${course.id}`, true);
		aboutId = undefined;
		if (id) await goto(`/learn/${course.id}/${id}`);
	}
</script>

<svelte:head><title>{course?.name ?? 'Course'} · Chessmode</title></svelte:head>

{#if course && stats}
	<main class="page">
		<header class="top">
			<a class="icon-btn" href="/" aria-label="Back">
				<ChevronLeft size={18} stroke-width={1.75} />
			</a>
			{#if isCustom(course.id)}
				<div class="course-actions">
					<a class="btn sm btn-surface" href="/create?edit={course.id}">Edit</a>
					<button class="icon-btn" onclick={remove} aria-label="Delete course">
						<Trash2 size={18} stroke-width={1.75} />
					</button>
				</div>
			{/if}
		</header>

		<div class="intro">
			<div class="hero card">
				<img src="/img/board-hero.webp" alt="" />
			</div>
			<div>
				<h1 class="h-display title">{course.name}</h1>
				<p class="tagline muted">{course.tagline}</p>
				<div class="meta">
					<span class="chip"><span class="side" class:black={course.side === 'b'}></span>{course.side === 'w' ? 'White' : 'Black'}</span>
					<span class="chip">{course.lines.length} lines</span>
					<span class="chip">{course.chapters.length} {course.chapters.length === 1 ? 'chapter' : 'chapters'}</span>
					<span class="chip">≈{Math.round(minutes / 6) * 6 >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`}</span>
				</div>
				{#if opening}
					<button class="btn sm btn-surface about" type="button" onclick={() => (aboutId = course.id)}>About this course</button>
				{/if}
			</div>
		</div>

		<button class="chip depth-button" onclick={() => { previewTier = choice.tier; chooser = true; }}>{scope?.tiers[scope.tier].name} · Change depth</button>
		<p class="muted scope-count">{scope?.learned}/{scope?.total} learned · {scope?.perfected}/{scope?.total} perfected</p>
		<div class="modes" aria-label="Training modes">
			{#each [{mode:'learn', label:'Learn'}, {mode:'practice', label:'Practice'}, {mode:'drill', label:'Drill'}, {mode:'time', label:'Time'}, {mode:'puzzle', label:'Puzzles'}, {mode:'arena', label:'Arena'}] as item}
				{@const mode = item.mode as CourseMode}
				{@const data = modeData(course.id)}
				{@const gate = modeAvailability(mode, course.lines.filter((l) => progress.has(l.key)).length, course.lines.length, mode === 'puzzle' ? data.puzzle : mode === 'arena' ? data.arena : true)}
				{@const href = mode === 'learn' ? (scope?.next ? `/learn/${course.id}/${scope.next.id}` : `/course/${course.id}`) : mode === 'practice' ? `/practice/run?course=${course.id}` : mode === 'drill' || mode === 'time' ? `/drill/run?mode=${mode}&course=${course.id}` : `/${mode === 'puzzle' ? 'puzzles' : 'arena'}/${course.id}`}
				{#if gate.kind === 'available'}<a class="option" {href}><b>{item.label}</b><small>Ready</small></a>{:else}<span class="option"><b>{item.label}</b><small>{gate.kind === 'locked' ? `Learn ${gate.remaining} more` : gate.reason}</small></span>{/if}
			{/each}
		</div>
		<div class="bar">
			<div class="progress"><i style:width="{(100 * stats.learned) / stats.total}%"></i></div>
			<span>{Math.round((100 * stats.learned) / stats.total)}%</span>
		</div>

		{#if coverage}
			<section class="card coverage">
				<button class="cov-head" onclick={() => (gapsOpen = !gapsOpen)} aria-expanded={gapsOpen}>
					<span class="ring" style:--p={coverage.score}><b>{Math.round(coverage.score * 100)}%</b></span>
					<span class="t">
						<b>Coverage</b>
						<small>Share of real opponents' replies the course answers, from {(sample / 1e6).toFixed(1)}M Lichess games.{coverage.gaps.length ? ` ${coverage.gaps.length} ${coverage.gaps.length === 1 ? 'gap' : 'gaps'}.` : ''}</small>
					</span>
					{#if coverage.gaps.length}<ChevronDown class={gapsOpen ? 'flip' : ''} size={18} stroke-width={1.75} />{/if}
				</button>
				{#if gapsOpen}
					<ol class="gaps" transition:slide={reveal}>
						{#each coverage.gaps.slice(0, 8) as gap (gap.key + gap.uci)}
							{@const n = gap.path.length}
							<li>
								<span class="mono path">{gap.path.map((san, i) => (i % 2 === 0 ? `${i / 2 + 1}.${san}` : san)).join(' ')}</span>
								<span class="gap-move"><b class="mono">{n % 2 === 0 ? `${n / 2 + 1}.` : `${Math.ceil(n / 2)}…`}{gap.san}</b> {Math.round(gap.share * 100)}% of players · reached in {(gap.reach * 100).toFixed(1)}% of games</span>
							</li>
						{/each}
					</ol>
				{/if}
			</section>
		{/if}

		<div class="seg sections" use:seg role="group" aria-label="Sections">
			<button aria-pressed={tab === 'lines'} onclick={() => (tab = 'lines')}>Lines</button>
			<button aria-pressed={tab === 'ideas'} onclick={() => (tab = 'ideas')}>Ideas</button>
			{#if hasQuiz}<button aria-pressed={tab === 'quiz'} onclick={() => (tab = 'quiz')}>Quiz</button>{/if}
		</div>

		{#if tab === 'lines'}
			{#each course.chapters as chapter, ci (chapter.id)}
				{@const learned = chapter.lines.filter((l) => progress.has(l.key)).length}
				<section class="chapter">
					<button class="ch-head" onclick={() => (open = open === chapter.id ? undefined : chapter.id)} aria-expanded={open === chapter.id}>
						<span class="num">{ci + 1}</span>
						<span class="t"><b>{chapter.name}</b><small>{learned}/{chapter.lines.length} learned{chapter.moves ? ` · ${chapter.moves}` : ''}</small></span>
						<ChevronDown class={open === chapter.id ? 'flip' : ''} size={18} stroke-width={1.75} />
					</button>
					{#if open === chapter.id}
						<p class="intro" transition:slide={reveal}>{chapter.intro}</p>
					{/if}
					<div class="card rows">
						{#each chapter.lines as line (line.key)}
							{@const st = lineStatus(progress, line.key, now)}
							<a class="row-item" href={st.kind === 'new' ? `/learn/${course.id}/${line.id}` : `/practice/run?line=${encodeURIComponent(line.key)}`}>
								<MiniBoard fen={lineEnd(line)} {orientation} size={52} />
								<span class="t">
									<b>{line.name}</b>
									{#if scope?.beyond.some(l => l.key === line.key)}<small>Beyond selected depth</small>{/if}
									<span class="mono">{lineTail(line, 4)}</span>
								</span>
								{#if st.kind === 'new'}
									<span class="chip">Learn</span>
								{:else if st.kind === 'due'}
									<span class="chip accent">Due</span>
								{:else}
									<span class="when">{relativeTime(st.due, now)}</span>
								{/if}
							</a>
						{/each}
					</div>
				</section>
			{/each}
		{:else if tab === 'ideas'}
			<p class="desc">{course.description}</p>
			{#each course.chapters as chapter, ci (chapter.id)}
				<article class="card idea">
					<p class="label">Chapter {ci + 1}{chapter.moves ? ` · ${chapter.moves}` : ''}</p>
					<h2 class="h-head">{chapter.name}</h2>
					<p>{chapter.intro}</p>
				</article>
			{/each}
		{:else}
			<p class="desc">Check that you know the plans, not only the moves.</p>
			<div class="card rows">
				{#each course.chapters.filter((c) => c.quiz.length) as chapter (chapter.id)}
					<a class="row-item" href="/quiz/{course.id}/{chapter.id}">
						<span class="qicon">?</span>
						<span class="t"><b>{chapter.name}</b><span>{chapter.quiz.length} questions</span></span>
						<ChevronRight size={18} stroke-width={1.75} />
					</a>
				{/each}
			</div>
		{/if}
	</main>

	<div class="cta">
		{#if stats.due}
			<a class="btn btn-primary block" href="/practice/run?course={course.id}">Practice {stats.due} due {stats.due === 1 ? 'line' : 'lines'}</a>
		{:else if stats.next}
			<a class="btn btn-primary block" href="/learn/{course.id}/{stats.next.id}">{stats.learned ? 'Learn the next line' : 'Start the course'}</a>
		{:else}
			<a class="btn btn-primary block" href="/drill/run?mode=drill&course={course.id}">Drill this course</a>
		{/if}
	</div>
{:else}
	<main class="page" style="padding-top:48px">
		<h1 class="h-title">Course not found</h1>
	</main>
{/if}

{#if chooser && scope}
	<DepthChooser tiers={scope.tiers} preview={previewTier} onpreview={(tier) => (previewTier = tier)} onconfirm={() => closeChooser(true)} ondismiss={() => closeChooser(false)} />
{/if}

{#if aboutId === course?.id && course && opening && scope}
	<CourseIntro {course} intro={opening} lines={scope.total} onstart={startFromAbout} ondismiss={closeAbout} />
{/if}

<style>
	.about {
		margin-top: 14px;
	}
	.depth-button {
		margin-top: 16px;
	}
	.scope-count {
		margin-top: 8px;
		font-size: 13px;
	}
	.modes {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 8px;
		margin-top: 16px;
	}
	.modes .option {
		display: grid;
		padding: 12px;
		gap: 4px;
	}
	.modes small {
		color: var(--text-3);
	}
	.sections {
		position: relative;
		z-index: 1;
		margin-bottom: 8px;
		background: var(--bg);
	}
	main.page {
		padding-bottom: calc(var(--tabbar-h) + 132px + var(--safe-bottom));
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 14px 0 10px;
	}
	.course-actions {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.hero {
		height: 200px;
		display: grid;
		place-items: center;
		background: var(--g-card-glow), radial-gradient(circle at 50% 40%, #252527, #141415 75%);
	}
	.hero img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		position: relative;
	}
	.title {
		margin-top: 20px;
	}
	.tagline {
		margin-top: 6px;
	}
	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 14px;
	}
	.side {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: #f4f4f2;
	}
	.side.black {
		background: #111;
		box-shadow: 0 0 0 1.5px #666;
	}
	.bar {
		display: flex;
		align-items: center;
		gap: 12px;
		margin: 18px 0 20px;
	}
	.bar .progress {
		flex: 1;
	}
	.bar span {
		font: 600 13px var(--mono);
		color: var(--text-2);
	}
	.coverage {
		padding: 4px 14px;
		margin-bottom: 18px;
	}
	.cov-head {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		text-align: left;
		padding: 10px 0;
	}
	.cov-head :global(svg) {
		color: var(--text-3);
		transition: transform 220ms var(--ease-out);
	}
	.cov-head :global(svg.flip) {
		transform: rotate(180deg);
	}
	.ring {
		--p: 0;
		width: 48px;
		height: 48px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		flex: 0 0 auto;
		background: conic-gradient(var(--accent) calc(var(--p) * 360deg), var(--surface-3) 0);
		position: relative;
	}
	.ring::before {
		content: '';
		position: absolute;
		inset: 4px;
		border-radius: 50%;
		background: var(--surface-2);
	}
	.ring b {
		position: relative;
		font: 600 12px var(--mono);
	}
	.gaps {
		list-style: none;
		padding: 0 0 8px;
		margin: 0;
		display: grid;
	}
	.gaps li {
		display: grid;
		gap: 2px;
		padding: 9px 0;
		border-top: 1px solid var(--stroke);
	}
	.path {
		font-size: 12px;
		color: var(--text-3);
		overflow-wrap: anywhere;
	}
	.gap-move {
		font-size: 13px;
		color: var(--text-2);
	}
	.gap-move b {
		color: var(--accent-hi);
	}
	.chapter {
		margin-top: 22px;
	}
	.ch-head {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		text-align: left;
		padding: 4px 2px 10px;
	}
	.ch-head :global(svg) {
		color: var(--text-3);
		transition: transform 220ms var(--ease-out);
	}
	.ch-head :global(svg.flip) {
		transform: rotate(180deg);
	}
	.num {
		width: 28px;
		height: 28px;
		border-radius: 9px;
		display: grid;
		place-items: center;
		font: 600 12px var(--mono);
		background: var(--surface-3);
		color: var(--text-2);
		flex: 0 0 auto;
	}
	.t {
		flex: 1;
		min-width: 0;
		display: grid;
	}
	.t b {
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.t small,
	.t span {
		font-size: 12px;
		color: var(--text-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.intro {
		margin: 0 0 12px;
		padding: 14px 16px;
		border-radius: var(--r-md);
		background: var(--surface-1);
		border: 1px solid var(--stroke);
		font-size: 14px;
		line-height: 1.55;
		color: var(--text-2);
	}
	.rows {
		padding: 2px 14px;
	}
	.row-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 0;
		border-top: 1px solid var(--stroke);
		position: relative;
	}
	.row-item:first-child {
		border-top: 0;
	}
	.row-item .t b {
		font-weight: 500;
	}
	.when {
		font-size: 12px;
		color: var(--text-3);
		white-space: nowrap;
	}
	.desc {
		margin: 4px 0 14px;
		color: var(--text-2);
		line-height: 1.55;
	}
	.idea {
		padding: 16px 18px;
		display: grid;
		gap: 6px;
		margin-bottom: 10px;
	}
	.idea p:last-child {
		font-size: 14px;
		line-height: 1.55;
		color: var(--text-2);
	}
	.qicon {
		width: 40px;
		height: 40px;
		border-radius: 12px;
		display: grid;
		place-items: center;
		background: var(--accent-soft);
		color: var(--accent-hi);
		font-weight: 700;
	}
	.cta {
		position: fixed;
		left: 50%;
		transform: translateX(-50%);
		bottom: calc(var(--tabbar-h) + 26px + var(--safe-bottom));
		width: min(calc(100% - 36px), 520px);
		z-index: 30;
	}
	/* At 1440×900 the section control sat in the tab bar. A shorter intro keeps it above that bar. */
	@media (min-width: 1000px) {
		main.page {
			max-width: 880px;
		}
		.intro {
			display: grid;
			grid-template-columns: 240px 1fr;
			gap: 22px;
			align-items: center;
		}
		.hero {
			height: 120px;
		}
		.title {
			margin-top: 0;
		}
		.modes {
			grid-template-columns: repeat(3, 1fr);
		}
	}
</style>
