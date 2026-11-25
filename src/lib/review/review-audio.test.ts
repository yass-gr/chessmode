import { describe, expect, it } from 'vitest';
import { boardCue, cueForEvent } from './review-audio.ts';

describe('review audio', () => {
	it('prioritizes check, promotion, capture and castle', () => {
		expect(boardCue('exd8=Q+')).toBe('check');
		expect(boardCue('exd8=Q')).toBe('promotion');
		expect(boardCue('Nxf7')).toBe('capture');
		expect(boardCue('O-O-O')).toBe('castle');
		expect(boardCue('e4')).toBe('move');
	});
	it('only signals a find on a changed eligible mainline landing', () => {
		const landing = { kind: 'landing', classification: 'find', color: 'w', playerColor: 'w', glyphs: true, mode: 'mainline', changed: true } as const;
		expect(cueForEvent(landing)).toBe('find');
		expect(cueForEvent({ ...landing, changed: false })).toBeUndefined();
		expect(cueForEvent({ ...landing, mode: 'playback' })).toBeUndefined();
		expect(cueForEvent({ ...landing, glyphs: false })).toBeUndefined();
		expect(cueForEvent({ ...landing, playerColor: 'b' })).toBeUndefined();
	});
});
