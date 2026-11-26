<script lang="ts">
	import { plural } from '#lib/format.ts';
	import { seg } from '#lib/components/seg.ts';
	import { onMount } from 'svelte';
	import { liveQuery } from 'dexie';
	import { goto } from '$app/navigation';
	import { db, getSetting, setSetting } from '#lib/db.ts';
	import { fetchGames, PLATFORMS, type OnlineSource } from '#lib/import/fetch-games.ts';
	import { parsePgn } from '#lib/import/pgn.ts';
	import { ChevronRight, Compass, LayoutGrid, List } from '@lucide/svelte';
	import type { GameRecord, GameReview } from '#lib/review/types.ts';

	const sources: OnlineSource[] = ['lichess', 'chesscom'];
	const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
	let source = $state<OnlineSource>('lichess');
	let usernames = $state<Record<OnlineSource, string>>({ lichess: '', chesscom: '' });
	let pgn = $state('');
	let games = $state<GameRecord[]>([]);
	let reviews = $state(new Map<string, GameReview>());
	let busy = $state(false);
	let message = $state('');
	let error = $state('');
	let importProgress = $state('');
	let controller: AbortController | undefined;

	onMount(() => {
		const subscription = liveQuery(async () => ({
			games: await db.games.orderBy('playedAt').reverse().toArray(),
			reviews: await db.reviews.toArray()
		})).subscribe({
			next: data => {
				games = data.games;
				const latest = new Map<string, GameReview>();
				for (const review of data.reviews) {
					if ((latest.get(review.gameId)?.depth ?? 0) < review.depth) latest.set(review.gameId, review);
				}
				reviews = latest;
			},
			error: () => { error = 'Could not read saved games on this device.'; }
		});
		for (const key of sources) {
			void getSetting('games.username.' + key, '').then(value => {
				if (!usernames[key]) usernames[key] = value;
			}).catch(() => { error = 'Could not read saved usernames.'; });
		}
		return () => {
			subscription.unsubscribe();
			controller?.abort();
		};
	});

	function result(game: GameRecord) {
		if (game.result === '1/2-1/2') return 'Draw';
		if (game.result === '*') return 'Unfinished';
		if (!game.userColor) return game.result;
		return (game.userColor === 'w') === (game.result === '1-0') ? 'Win' : 'Loss';
	}

	async function importOnline(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		const platform = source;
		const username = usernames[platform].trim();
		const request = new AbortController();
		controller = request;
		busy = true;
		error = '';
		message = '';
		importProgress = '';
		let timedOut = false;
		let timeout: number | undefined;
		try {
			const timedImport = new Promise<never>((_, reject) => {
				timeout = window.setTimeout(() => {
					timedOut = true;
					request.abort();
					reject(new Error('Import took too long. Check your connection and try again.'));
				}, 120_000);
			});
			const importTask = async () => {
				const result = await fetchGames(
					platform, username, request.signal,
					(completed, total) => {
						if (!request.signal.aborted) importProgress = `${completed}/${total} ${plural(total, 'game')}`;
					}
				);
				await db.transaction('rw', db.games, db.settings, async () => {
					await db.games.bulkPut(result.games);
					await setSetting('games.username.' + platform, username);
				});
				return result;
			};
			const { games: imported, missingArchives } = await Promise.race([importTask(), timedImport]);
			message = imported.length ? 'Imported ' + imported.length + ' standard games.' : 'No recent standard games found.';
			if (missingArchives) message += ' One Chess.com archive was unavailable.';
		} catch (cause) {
			if (timedOut) error = 'Import took too long. Check your connection and try again.';
			else if (!request.signal.aborted) error = cause instanceof Error ? cause.message : 'Could not import these games.';
		} finally {
			if (timeout !== undefined) window.clearTimeout(timeout);
			busy = false;
			importProgress = '';
			controller = undefined;
		}
	}

	async function importPgn(event: SubmitEvent) {
		event.preventDefault();
		let game: GameRecord;
		error = '';
		message = '';
		try {
			game = parsePgn(pgn);
		} catch (cause) {
			error = cause instanceof Error && /^(Only standard|The PGN)/.test(cause.message)
				? cause.message : 'This PGN could not be read. Paste one complete game with legal moves.';
			return;
		}
		try {
			await db.games.put(game);
			await goto('/review/' + game.id);
		} catch {
			error = 'Could not save the pasted game on this device.';
		}
	}
</script>

<svelte:head><title>Matches · Chessmode</title></svelte:head>

<main class="page matches">
	<header>
		<h1>Matches</h1>
		<nav class="entries" aria-label="Analysis">
			<a class="card entry" href="/explorer">
				<span class="mark" aria-hidden="true">
					<Compass size={18} stroke-width={1.75} />
				</span>
				<span class="copy">
					<b>Opening explorer</b>
					<span>How often each reply is played.</span>
				</span>
			</a>
			<a class="card entry" href="/analysis">
				<span class="mark" aria-hidden="true">
					<LayoutGrid size={18} stroke-width={1.75} />
				</span>
				<span class="copy">
					<b>Analysis board</b>
					<span>Play both sides and run the engine.</span>
				</span>
			</a>
			<a class="card entry" href="/opening-review">
				<span class="mark" aria-hidden="true">
					<List size={18} stroke-width={1.75} />
				</span>
				<span class="copy">
					<b>Opening review</b>
					<span>Where your games left a course.</span>
				</span>
			</a>
		</nav>
	</header>
	<div class="columns">
		<section class="card import" aria-label="Import games">
			<h2>Import games</h2>
			<form onsubmit={importOnline}>
				<div class="seg" use:seg role="group" aria-label="Game platform">
					{#each sources as platform}
						<button type="button" disabled={busy} aria-pressed={source === platform} onclick={() => { source = platform; }}>{PLATFORMS[platform]}</button>
					{/each}
				</div>
				<label class="field">
					<input aria-label="Username" placeholder={PLATFORMS[source] + ' username'} bind:value={usernames[source]} required disabled={busy} autocapitalize="none" spellcheck={false} />
				</label>
				<button class="btn btn-primary block" disabled={busy}>{busy ? importProgress ? 'Importing… ' + importProgress : 'Importing…' : source === 'lichess' ? 'Import last 50 games' : 'Import recent games'}</button>
			</form>
			<details>
				<summary><ChevronRight size={18} stroke-width={1.75} />Paste a PGN</summary>
				<form onsubmit={importPgn}>
					<textarea aria-label="Game PGN" placeholder="1. e4 e5 2. Nf3…" bind:value={pgn} required spellcheck={false} rows="5"></textarea>
					<button class="btn block">Review PGN</button>
				</form>
			</details>
			{#if message}<p class="feedback" role="status">{message}</p>{/if}
			{#if error}<p class="feedback error" role="alert">{error}</p>{/if}
		</section>
		<section aria-labelledby="games-label">
			<h2 id="games-label">Saved games <span>{games.length}</span></h2>
			{#if games.length}
				<div class="card games">
					{#each games as game (game.id)}
						{@const opponent = game.userColor === 'w' ? game.black.name : game.white.name}
						{@const review = reviews.get(game.id)}
						{@const accuracy = game.userColor === 'b' ? review?.black.accuracy : review?.white.accuracy}
						<a class="game" href={'/review/' + game.id}>
							<div>
								<b>{game.userColor ? 'vs. ' + opponent : game.white.name + ' vs. ' + game.black.name}</b>
								<span class="metadata">{[result(game), game.speed, date.format(game.playedAt)].filter(Boolean).join(' · ')}</span>
								{#if review?.opening || game.opening}<span class="opening">{(review?.opening ?? game.opening)?.name}</span>{/if}
							</div>
							<span class="chip" title={review ? 'Accuracy' : undefined}>
								{#if review && !game.userColor}{review.white.accuracy.toFixed(1)}% / {review.black.accuracy.toFixed(1)}%
								{:else if accuracy !== undefined}{accuracy.toFixed(1)}%{:else}Review{/if}
							</span>
						</a>
					{/each}
				</div>
			{:else}
				<div class="card empty"><img src="/img/empty/matches.webp" alt="" width="120" height="120" style="object-fit: contain" /><p>Imported games appear here.</p></div>
			{/if}
		</section>
	</div>
</main>

<style>
	.matches { max-width: 1060px; }
	header {
		margin-bottom: 18px;
		padding-top: 28px;
	}
	h1 { font-size: clamp(28px, 4vw, 38px); letter-spacing: -.045em; line-height: 1.1; }
	.entries {
		display: grid;
		gap: 8px;
		margin-top: 14px;
	}
	.entry {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 72px;
		padding: 12px 14px;
	}
	.entry > * {
		position: relative;
		z-index: 1;
	}
	.mark {
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		width: 36px;
		height: 36px;
		border-radius: 12px;
		background: var(--accent-soft);
		color: var(--accent-hi);
	}

	.copy {
		min-width: 0;
	}
	.copy b,
	.copy span {
		display: block;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.copy b {
		font-size: 14px;
		letter-spacing: -0.02em;
	}
	.copy span {
		color: var(--text-2);
		font-size: 12px;
		line-height: 1.35;
	}
	h2 { font-size: 17px; letter-spacing: -.02em; }
	h2 span { margin-left: 6px; color: var(--text-2); font: 12px var(--mono); }
	.columns { display: grid; gap: 22px; align-items: start; }
	:global(.native) .columns { grid-template-columns: minmax(0, 1fr); }
	.import { display: grid; gap: 14px; padding: 16px; background: var(--g-card-glow), var(--surface-2); }
	form { display: grid; gap: 11px; }
	summary {
		display: flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		color: var(--text-2);
		font-weight: 600;
		list-style: none;
	}
	summary::-webkit-details-marker { display: none; }
	summary :global(svg) {
		flex: 0 0 auto;
		transition: transform 220ms var(--ease-out);
	}
	details[open] > summary :global(svg) { transform: rotate(90deg); }
	details[open] form { margin-top: 12px; }
	textarea { width: 100%; padding: 10px; border: 1px solid var(--stroke-2); border-radius: var(--r-sm); resize: vertical; background: var(--bg); color: var(--text); font: 13px/1.5 var(--mono); }
	.feedback { color: var(--text); font-size: 13px; }
	.error { color: var(--bad); }
	.games, .empty { margin-top: 9px; }
	.games { padding: 0 14px; }
	.game { min-height: 70px; padding: 11px 0; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
	.game + .game { border-top: 1px solid var(--stroke); }
	@media (hover: hover) and (pointer: fine) { .game:hover b { color: var(--accent-hi); } }
	.game div { min-width: 0; }
	.game b, .metadata, .opening { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
	.metadata, .opening, .empty { color: var(--text-2); font-size: 13px; }
	.opening { font-size: 12px; }
	.chip { flex-shrink: 0; }
	.empty { padding: 14px; }
	@media (min-width: 780px) {
		.columns { grid-template-columns: minmax(300px, 370px) 1fr; gap: 28px; }
		.entries { grid-template-columns: repeat(3, minmax(0, 1fr)); }
	}
	@media (min-width: 1024px) {
		.matches {
			max-width: 1200px;
		}
	}
</style>
