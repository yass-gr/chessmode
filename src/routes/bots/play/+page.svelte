<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ResultSheet from '#lib/components/train/ResultSheet.svelte';
	import Table from '#lib/bots/Table.svelte';
	import { botById, botMove, chooseBotMove, gamePgn, outcomeText, playerMove, resignGame, resolveColor, startBotGame } from '#lib/bots/bots.ts';
	import type { BotColor, BotGame, BotProfile } from '#lib/bots/types.ts';
	import type { Fen, Uci } from '#lib/chess/types.ts';
	import { db } from '#lib/db.ts';
	import { getEngine } from '#lib/engine/stockfish.ts';
	import { parsePgn } from '#lib/import/pgn.ts';
	import { DEFAULT_PREFERENCES, type Preferences } from '#lib/settings/types.ts';
	import { play } from '#lib/sound.ts';

	let game = $state<BotGame | undefined>();
	let bot = $state<BotProfile | undefined>();
	let preferences = $state<Preferences>({ ...DEFAULT_PREFERENCES });
	let settings = $state(false);
	let view = $state<number | undefined>();
	let error = $state('');
	let busy = $state(false);
	let reviewId = $state('');
	let search: AbortController | undefined;
	let sessions = 0;
	let colorChoice: BotColor = 'w';

	function cue(san: string) {
		if (san.includes('#')) play('complete');
		else if (san.includes('+')) play('check');
		else if (san.includes('x')) play('capture');
		else play('move');
	}

	function stopSearch() {
		search?.abort();
		search = undefined;
		busy = false;
	}

	function begin(profile: BotProfile, choice: BotColor) {
		stopSearch();
		view = undefined;
		error = '';
		reviewId = '';
		sessions += 1;
		const player = resolveColor(choice, Math.random());
		const started = startBotGame(profile.id, player, `b${sessions}`);
		game = started;
		if (started.phase === 'bot') void reply(started, profile);
	}

	async function reply(current: BotGame, profile: BotProfile) {
		stopSearch();
		const ctrl = new AbortController();
		search = ctrl;
		busy = true;
		try {
			const analysis = await getEngine().analyse(current.fen, {
				depth: profile.depth,
				movetime: profile.movetime,
				multiPv: 2,
				signal: ctrl.signal
			});
			if (search !== ctrl || game?.session !== current.session || game.phase !== 'bot') return;
			const moves = analysis.lines.map((line) => line.pv[0]).filter((move): move is Uci => !!move);
			const uci = chooseBotMove(moves, profile.slip, Math.random());
			if (!uci) {
				error = 'No legal reply came back.';
				return;
			}
			const next = botMove(current, current.session, uci);
			if (next === current || game?.session !== current.session) return;
			cue(next.plies.at(-1)?.san ?? '');
			game = next;
			if (next.phase === 'bot') void reply(next, profile);
		} catch (reason) {
			if (search === ctrl && !(reason instanceof Error && reason.name === 'AbortError')) error = 'The bot stopped. Restart the game.';
		} finally {
			if (search === ctrl) busy = false;
		}
	}

	function onmove(uci: string) {
		if (!game || !bot || view !== undefined || game.phase !== 'player') return;
		const next = playerMove(game, game.session, uci);
		if (next === game) return;
		cue(next.plies.at(-1)?.san ?? '');
		game = next;
		view = undefined;
		if (next.phase === 'bot') void reply(next, bot);
	}

	async function openReview() {
		if (!game || !bot || game.phase !== 'over' || !game.plies.length) return;
		const white = game.player === 'w' ? 'You' : bot.name;
		const black = game.player === 'b' ? 'You' : bot.name;
		const record = { ...parsePgn(gamePgn(game, white, black)), userColor: game.player };
		await db.games.put(record);
		reviewId = record.id;
		await goto(`/review/${record.id}`);
	}

	$effect(() => {
		const id = page.url.searchParams.get('bot') ?? undefined;
		const choice = page.url.searchParams.get('color');
		const profile = botById(id);
		const nextColor: BotColor = choice === 'b' || choice === 'random' ? choice : 'w';
		if (!profile) {
			bot = undefined;
			return;
		}
		if (game && bot?.id === profile.id && colorChoice === nextColor) return;
		bot = profile;
		colorChoice = nextColor;
		begin(profile, nextColor);
	});

	onDestroy(stopSearch);
</script>

<svelte:head><title>{bot ? `${bot.name} · Chessmode` : 'Bot · Chessmode'}</title></svelte:head>

{#if game && bot}
	<Table
		{game}
		{bot}
		{preferences}
		{settings}
		{view}
		{error}
		{busy}
		{onmove}
		onview={(ply) => (view = ply)}
		onlive={() => (view = undefined)}
		onrestart={() => begin(bot!, colorChoice)}
		ontogglesettings={() => (settings = !settings)}
		onpreferences={(next) => (preferences = next)}
		onresign={() => { stopSearch(); if (game) game = resignGame(game); }}
	/>
{:else}
	<main class="page">
		<p class="muted">That bot is not in this set.</p>
		<a class="btn btn-primary" href="/bots">Choose a bot</a>
	</main>
{/if}

{#if game?.phase === 'over'}
	<ResultSheet expression={game.result === '1/2-1/2' ? 'thinking' : (game.result === '1-0') === (game.player === 'w') ? 'celebrating' : 'encouraging'} eyebrow={bot?.name} title={outcomeText(game)}>
		{#snippet actions()}
			<button class="btn btn-primary block" type="button" onclick={openReview}>Review the game</button>
			<button class="btn btn-surface block" type="button" onclick={() => bot && begin(bot, colorChoice)}>Play again</button>
			<a class="btn btn-ghost block" href="/bots">Different bot</a>
		{/snippet}
	</ResultSheet>
{/if}

