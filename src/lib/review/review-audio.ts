import type { Color } from '#lib/chess/types.ts';
import type { Classification } from '#lib/review/types.ts';
import { play, type Cue } from '#lib/sound.ts';

export type BoardCue = Extract<Cue, 'move' | 'capture' | 'check' | 'castle' | 'promotion'>;

/** SAN describes the move being animated, including the move undone on backward steps. */
export function boardCue(san: string): BoardCue {
	if (/[+#]$/.test(san)) return 'check';
	if (san.includes('=')) return 'promotion';
	if (san.includes('x')) return 'capture';
	if (san.startsWith('O-O')) return 'castle';
	return 'move';
}

export type ReviewAudioEvent =
	| { kind: 'animated-move'; san: string }
	| { kind: 'landing'; classification: Classification; color: Color; playerColor: Color | undefined; glyphs: boolean; mode: 'mainline' | 'retry' | 'playback'; changed: boolean }
	| { kind: 'retry'; correct: boolean }
	| { kind: 'navigation' };

export function cueForEvent(event: ReviewAudioEvent): Cue | undefined {
	switch (event.kind) {
		case 'animated-move': return boardCue(event.san);
		case 'landing': return event.changed && event.mode === 'mainline' && event.glyphs && event.playerColor === event.color && event.classification === 'find' ? 'find' : undefined;
		case 'retry': return event.correct ? 'correct' : 'wrong';
		case 'navigation': return undefined;
	}
}

/** Call once per actual animation or settled landing, not for intermediate direct-jump positions. */
export function playReviewEvent(event: ReviewAudioEvent): void {
	if (event.kind === 'navigation' && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
	const cue = cueForEvent(event);
	if (cue) play(cue);
}
