<script lang="ts">
	import Board from '#lib/components/Board.svelte';
	let fen = $state('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
</script>

<main class="page stack" style="padding-top:24px">
	<h1 class="h-display">Chessmode</h1>
	<Board {fen} movable="both" arrows={[{ from: 'e2', to: 'e4', brush: 'accent' }]} marker={{ square: 'e4', glyph: '★', color: '#3ecf8e' }} />
</main>
