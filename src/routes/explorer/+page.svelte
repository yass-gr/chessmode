<script lang="ts">
	import { ChevronLeft } from '@lucide/svelte';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Board, { type Arrow } from '#lib/components/Board.svelte';
	import { START_FEN, type Fen, type Uci } from '#lib/chess/types.ts';
	import { courses } from '#lib/courses/index.ts';
	import {
		EXPLORER_BANDS,
		analysisHref,
		explorerHref,
		lichessExplorerUrl,
		localSample,
		parseLichessExplorer,
		playExplorer,
		readBand,
		replayExplorer,
		viewPosition,
		type BandChoice,
		type ExplorerPosition,
		type ExplorerReply,
		type ExplorerStep,
		type PositionSample
	} from '#lib/explorer/browse.ts';
	import { loadExplorer, type Explorer } from '#lib/explorer/types.ts';

	const list = courses.slice().sort((a, b) => a.name.localeCompare(b.name));
	const remoteCache = new Map<string, PositionSample>();

	let ready = $state(false);
	let courseId = $state<string | undefined>();
	let band = $state<BandChoice>('all');
	let steps = $state<ExplorerStep[]>([{ fen: START_FEN }]);
	let cursor = $state(0);
	let position = $state<ExplorerPosition | undefined>();
	let origin = $state<'saved' | 'online' | 'offline'>('saved');
	let month = $state('');
	let notice = $state('');
	let loading = $state(true);
	let copied = $state('');
	let request = 0;

	const fen = $derived((steps[cursor]?.fen ?? START_FEN) as Fen);
	const incoming = $derived(steps[cursor]?.uci);
	const arrow = $derived<Arrow[]>(incoming ? [{ from: incoming.slice(0, 2), to: incoming.slice(2, 4), brush: 'accent' }] : []);
	const played = $derived((position?.replies ?? []).filter((reply) => (reply.count ?? 0) > 0));
	const zeros = $derived(position && (position.kind === 'known' || position.kind === 'sparse') ? position.replies.filter((reply) => reply.zero) : []);
	const courseName = $derived(list.find((course) => course.id === courseId)?.name);

	function shareText(reply: ExplorerReply) {
		if (reply.share === null || reply.count === null) return '—';
		const pct = reply.share * 100;
		return `${reply.count.toLocaleString()} · ${pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%`;
	}

	onMount(() => {
		const params = page.url.searchParams;
		const course = params.get('course');
		courseId = course && list.some((item) => item.id === course) ? course : undefined;
		band = readBand(params.get('band'));
		const start = (params.get('fen') || START_FEN) as Fen;
		const moves = (params.get('moves') ?? '').split(',').filter(Boolean) as Uci[];
		steps = replayExplorer(start, moves);
		cursor = Math.max(0, steps.length - 1);
		ready = true;
		return () => {
			request += 1;
		};
	});

	$effect(() => {
		if (!ready) return;
		const id = courseId;
		const chosen = band;
		const at = fen;
		const token = ++request;
		const controller = new AbortController();
		void loadPosition(id, chosen, at, token, controller.signal);
		return () => controller.abort();
	});

	$effect(() => {
		if (!ready) return;
		const moves = steps.slice(1, cursor + 1).flatMap((step) => (step.uci ? [step.uci] : []));
		const href = explorerHref({ courseId, band, fen: steps[0]?.fen, moves });
		if (page.url.pathname + page.url.search !== href) void goto(href, { replace: true, shallow: true, reset: false });
	});

	async function loadPosition(id: string | undefined, chosen: BandChoice, at: Fen, token: number, signal: AbortSignal) {
		loading = true;
		const ids = id ? [id] : list.map((course) => course.id);
		const loaded = (await Promise.all(ids.map((course) => loadExplorer(course)))).filter((item): item is Explorer => !!item);
		if (token !== request) return;
		month = loaded[0]?.month ?? '';
		const local = localSample(loaded, at, chosen);
		if (local) {
			position = viewPosition(at, local);
			origin = 'saved';
			notice = '';
			loading = false;
			return;
		}
		const key = `${at} ${chosen}`;
		const cached = remoteCache.get(key);
		if (cached) {
			position = viewPosition(at, cached.present ? cached : undefined);
			origin = 'online';
			notice = cached.present ? '' : 'Lichess has no games for this position.';
			loading = false;
			return;
		}
		try {
			const response = await fetch(lichessExplorerUrl(at, chosen), { signal, headers: { Accept: 'application/json' } });
			if (!response.ok) throw new Error(String(response.status));
			const sample = parseLichessExplorer(await response.json());
			remoteCache.set(key, sample);
			if (token !== request) return;
			position = viewPosition(at, sample.present ? sample : undefined);
			origin = 'online';
			notice = sample.present ? '' : 'Lichess has no games for this position.';
		} catch {
			if (signal.aborted || token !== request) return;
			position = viewPosition(at, undefined);
			origin = 'offline';
			notice = 'Offline. Saved opening data does not include this position.';
		} finally {
			if (token === request) loading = false;
		}
	}

	function choose(uci: Uci) {
		try {
			steps = playExplorer(steps, cursor, uci);
			cursor = steps.length - 1;
		} catch {
			notice = 'That move is not legal here.';
		}
	}

	function shift(delta: number) {
		cursor = Math.min(steps.length - 1, Math.max(0, cursor + delta));
	}

	async function copyLink() {
		const href = explorerHref({
			courseId,
			band,
			fen: steps[0]?.fen,
			moves: steps.slice(1, cursor + 1).flatMap((step) => (step.uci ? [step.uci] : []))
		});
		const url = new URL(href, window.location.origin).toString();
		try {
			await navigator.clipboard.writeText(url);
			copied = 'Link copied.';
		} catch {
			copied = url;
		}
	}
</script>

<svelte:head><title>Opening explorer · Chessmode</title></svelte:head>

<main class="page explorer">
	<header class="top">
		<a class="icon-btn" href="/matches" aria-label="Back to Matches">
			<ChevronLeft size={18} stroke-width={1.75} />
		</a>
		<div class="titles">
			<h1>Opening explorer</h1>
			<p>{courseName ?? 'All saved courses'}</p>
		</div>
	</header>

	<div class="workspace">
		<section class="board-column" aria-label="Opening position">
			<Board {fen} arrows={arrow} lastMove={incoming ? [incoming.slice(0, 2), incoming.slice(2, 4)] : undefined} movable="none" />
			{#if steps[cursor]?.san}<p class="selected">Selected · {steps[cursor].san}</p>{/if}
			<div class="nav">
				<button class="btn sm btn-surface" type="button" disabled={cursor === 0} onclick={() => shift(-1)}>Back</button>
				<button class="btn sm btn-surface" type="button" disabled={cursor >= steps.length - 1} onclick={() => shift(1)}>Forward</button>
				<a class="btn sm btn-primary" href={analysisHref(fen)}>Analyse</a>
			</div>
		</section>

		<section class="panel" aria-label="Replies">
			<div class="scroll" role="group" aria-label="Course">
				<button class="chip" class:accent={!courseId} type="button" aria-pressed={!courseId} onclick={() => (courseId = undefined)}>All</button>
				{#each list as course (course.id)}
					<button class="chip" class:accent={courseId === course.id} type="button" aria-pressed={courseId === course.id} onclick={() => (courseId = course.id)}>{course.name}</button>
				{/each}
			</div>
			<div class="scroll" role="group" aria-label="Rating band">
				<button class="chip" class:accent={band === 'all'} type="button" aria-pressed={band === 'all'} onclick={() => (band = 'all')}>All</button>
				{#each EXPLORER_BANDS as value (value)}
					<button class="chip" class:accent={band === value} type="button" aria-pressed={band === value} onclick={() => (band = value)}>{value}</button>
				{/each}
			</div>

			<p class="status" role="status">
				{#if loading}
					Loading games…
				{:else if position?.kind === 'sparse'}
					Sparse sample · {position.games.toLocaleString()} games
				{:else if position?.kind === 'empty-band'}
					No games in this rating band
				{:else if position?.kind === 'unavailable'}
					{notice || 'No opening data for this position'}
				{:else if position}
					{position.games.toLocaleString()} games
					{#if origin === 'saved' && month}· saved {month}{/if}
					{#if origin === 'online'}· Lichess{/if}
				{/if}
			</p>
			{#if copied}<p class="status">{copied}</p>{/if}

			{#if position?.kind === 'empty-band'}
				<p class="hint">This position is in the saved data. The selected band has no games, which is not the same as a move scoring zero.</p>
			{:else if position?.kind === 'unavailable'}
				<p class="hint">Nothing was measured here. A move with zero games only appears once a sample exists.</p>
			{/if}

			<div class="replies">
				{#each played as reply (reply.uci)}
					<button class="reply" type="button" onclick={() => choose(reply.uci)}>
						<b>{reply.san}</b>
						<span class="track" aria-hidden="true"><span style:width="{(reply.share ?? 0) * 100}%"></span></span>
						<span class="count">{shareText(reply)}</span>
					</button>
				{/each}
			</div>

			{#if zeros.length}
				<h2>Never played <span>{zeros.length}</span></h2>
				<div class="zeros">
					{#each zeros as reply (reply.uci)}
						<button class="chip zero" type="button" onclick={() => choose(reply.uci)}>{reply.san} · 0</button>
					{/each}
				</div>
			{/if}

			<button class="btn sm btn-surface block" type="button" onclick={copyLink}>Copy position link</button>
		</section>
	</div>
</main>

<style>
	.explorer {
		max-width: 1080px;
		padding-bottom: calc(28px + var(--safe-bottom));
	}
	.top {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px 0 16px;
	}
	.titles {
		flex: 1;
		min-width: 0;
	}
	h1 {
		font-size: 22px;
		letter-spacing: -0.03em;
		line-height: 1.15;
	}
	.top p,
	h2 span,
	.hint,
	.status {
		color: var(--text-2);
	}
	.top p {
		font-size: 13px;
		line-height: 1.35;
	}
	.workspace {
		display: grid;
		gap: 18px;
	}
	.board-column,
	.panel {
		display: grid;
		gap: 12px;
		align-content: start;
	}
	.selected {
		font-weight: 650;
		color: var(--accent-hi);
	}
	.nav {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		gap: 8px;
	}
	.nav .btn {
		width: 100%;
		padding-inline: 10px;
	}
	.scroll {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		scrollbar-width: none;
		margin: 0 calc(-1 * var(--gutter));
		padding: 0 var(--gutter) 2px;
	}
	.scroll .chip {
		flex: 0 0 auto;
		height: 34px;
		padding: 0 14px;
		font-size: 13px;
		cursor: pointer;
	}
	.zeros {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip {
		cursor: pointer;
	}
	.zero {
		color: var(--text-3);
	}
	.status,
	.hint {
		font-size: 13px;
	}
	.replies {
		display: grid;
		gap: 8px;
	}
	.reply {
		display: grid;
		grid-template-columns: 4.5rem minmax(0, 1fr) auto;
		gap: 10px;
		align-items: center;
		min-height: 44px;
		padding: 8px 12px;
		border: 1px solid var(--stroke);
		border-radius: var(--r-sm);
		background: var(--surface-2);
		text-align: left;
		transition: border-color var(--dur-press) var(--ease-out);
	}
	.reply:active {
		border-color: var(--accent-line);
	}
	.track {
		display: block;
		height: 8px;
		overflow: hidden;
		border-radius: var(--r-pill);
		background: var(--surface-3);
	}
	.track span {
		display: block;
		height: 100%;
		border-radius: inherit;
		background: var(--accent);
		transition: width var(--dur-push) var(--ease-out);
	}
	.count {
		font: 12px var(--mono);
		color: var(--text-2);
	}
	h2 {
		font-size: 15px;
	}
	h2 span {
		margin-left: 6px;
		font: 12px var(--mono);
	}
	.zeros {
		max-height: 140px;
		overflow: auto;
	}
	@media (prefers-reduced-motion: reduce) {
		.track span {
			transition: none;
		}
	}
	@media (min-width: 900px) {
		.workspace {
			grid-template-columns: minmax(280px, 460px) minmax(0, 1fr);
			gap: 28px;
			align-items: start;
		}
		.scroll {
			margin: 0;
			padding: 0 0 2px;
		}
	}
</style>
