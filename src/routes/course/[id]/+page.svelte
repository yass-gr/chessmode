<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { getCourse } from '#lib/courses/index.ts';
	import type { LineKey } from '#lib/courses/types.ts';
	import type { LineProgress } from '#lib/db.ts';
	import MiniBoard from '#lib/components/MiniBoard.svelte';
	import { loadProgress, setActiveCourse } from '#lib/train/data.ts';
	import { courseStats, lineEnd, lineStatus, lineTail, relativeTime } from '#lib/train/stats.ts';
	import { courseCoverage, type Coverage } from '#lib/explorer/coverage.ts';
	import { loadExplorer } from '#lib/explorer/types.ts';

	const course = $derived(getCourse(page.params.id));
	let progress = $state.raw(new Map<LineKey, LineProgress>());
	let tab = $state<'lines' | 'ideas' | 'quiz'>('lines');
	let open = $state<string | undefined>();
	let coverage = $state.raw<Coverage>();
	let gapsOpen = $state(false);
	let sample = $state(0);
	const now = Date.now();

	onMount(async () => {
		progress = await loadProgress();
		if (!course) return;
		await setActiveCourse(course.id);
		const explorer = await loadExplorer(course.id);
		if (explorer) {
			coverage = courseCoverage(course, explorer);
			sample = explorer.games;
		}
	});

	const stats = $derived(course ? courseStats(course, progress, now) : undefined);
	const orientation = $derived(course?.side === 'w' ? 'white' : 'black');
	const minutes = $derived(course ? Math.round(course.lines.reduce((s, l) => s + l.plies.filter((p) => p.student).length, 0) * 0.25) : 0);
</script>

<svelte:head><title>{course?.name ?? 'Course'} · Chessmode</title></svelte:head>

{#if course && stats}
	<main class="page">
		<header class="top">
			<a class="icon-btn" href="/" aria-label="Back">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
			</a>
		</header>

		<div class="hero card">
			<img src="/img/board-hero.webp" alt="" />
		</div>

		<h1 class="h-display title">{course.name}</h1>
		<p class="tagline muted">{course.tagline}</p>
		<div class="meta">
			<span class="chip"><span class="side" class:black={course.side === 'b'}></span>{course.side === 'w' ? 'White' : 'Black'}</span>
			<span class="chip">{course.lines.length} lines</span>
			<span class="chip">{course.chapters.length} chapters</span>
			<span class="chip">≈{Math.round(minutes / 6) * 6 >= 60 ? `${Math.round(minutes / 60)} h` : `${minutes} min`}</span>
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
					{#if coverage.gaps.length}<svg class:flip={gapsOpen} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>{/if}
				</button>
				{#if gapsOpen}
					<ol class="gaps">
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

		<div class="seg" role="group" aria-label="Sections">
			<button aria-pressed={tab === 'lines'} onclick={() => (tab = 'lines')}>Lines</button>
			<button aria-pressed={tab === 'ideas'} onclick={() => (tab = 'ideas')}>Ideas</button>
			<button aria-pressed={tab === 'quiz'} onclick={() => (tab = 'quiz')}>Quiz</button>
		</div>

		{#if tab === 'lines'}
			{#each course.chapters as chapter, ci (chapter.id)}
				{@const learned = chapter.lines.filter((l) => progress.has(l.key)).length}
				<section class="chapter">
					<button class="ch-head" onclick={() => (open = open === chapter.id ? undefined : chapter.id)} aria-expanded={open === chapter.id}>
						<span class="num">{ci + 1}</span>
						<span class="t"><b>{chapter.name}</b><small>{learned}/{chapter.lines.length} learned{chapter.moves ? ` · ${chapter.moves}` : ''}</small></span>
						<svg class:flip={open === chapter.id} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9l6 6 6-6" /></svg>
					</button>
					{#if open === chapter.id}
						<p class="intro">{chapter.intro}</p>
					{/if}
					<div class="card rows">
						{#each chapter.lines as line (line.key)}
							{@const st = lineStatus(progress, line.key, now)}
							<a class="row-item" href={st.kind === 'new' ? `/learn/${course.id}/${line.id}` : `/practice/run?line=${encodeURIComponent(line.key)}`}>
								<MiniBoard fen={lineEnd(line)} {orientation} size={52} />
								<span class="t">
									<b>{line.name}</b>
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
						<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6" /></svg>
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

<style>
	.top {
		padding: 14px 0 10px;
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
	.cov-head svg {
		color: var(--text-3);
		transition: transform 0.2s;
	}
	.cov-head svg.flip {
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
	.ch-head svg {
		color: var(--text-3);
		transition: transform 0.2s;
	}
	.ch-head svg.flip {
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
</style>
