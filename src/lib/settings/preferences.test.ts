import { describe, expect, it } from 'vitest';
import { parsePreferences, parseCoursePreferences, parseReviewPreferences, shouldSkipSharedStart, showEvaluation, opponentDelay } from './preferences.ts';

describe('trainer preferences', () => {
	it('validates stored values and preserves the old mute setting', () => {
		const p = parsePreferences({ theme: 'invalid', textSize: 'large', pieces: 'outline' }, true);
		expect(p.theme).toBe('default');
		expect(p.textSize).toBe('large');
		expect(p.sound).toBe(false);
		expect(p.pieces).toBe('cburnett');
		expect(parsePreferences({ pieces: 'default' }).pieces).toBe('cburnett');
		expect(parsePreferences({ pieces: 'merida' }).pieces).toBe('merida');
	});
 it('keeps course defaults independent', () => { expect(parseCoursePreferences({ fastOpponent: false })).toEqual({ fastOpponent: false, skipSharedStart: false }); });
 it('only skips a usable shared opening', () => { const args = { mode: 'learn' as const, enabled: true, lineCount: 2, sharedPlies: 2, playerMovesAfter: 1, firstLearn: false }; expect(shouldSkipSharedStart(args)).toBe(true); expect(shouldSkipSharedStart({ ...args, firstLearn: true })).toBe(false); expect(shouldSkipSharedStart({ ...args, playerMovesAfter: 0 })).toBe(false); expect(shouldSkipSharedStart({ ...args, mode: 'time' })).toBe(false); });
 it('applies mode-specific evaluation and pace', () => { expect(showEvaluation('puzzles', parsePreferences(null))).toBe(false); expect(opponentDelay('drill', parseCoursePreferences({ fastOpponent: false }))).toBe(500); });
});

describe('review preferences', () => {
	it('uses the player side until a perspective is saved', () => {
		expect(parseReviewPreferences(null, 'b').perspective).toBe('b');
		expect(parseReviewPreferences({ perspective: 'both', autoplay: false, voice: true, overlays: 'best' })).toEqual({
			perspective: 'both', overlays: 'best', autoplay: false, voice: true, coach: true, glyphs: true
		});
		expect(parseReviewPreferences({ overlays: 'nope', perspective: 'x' }, 'w').overlays).toBe('both');
		expect(parseReviewPreferences({ overlays: 'nope', perspective: 'x' }, 'w').perspective).toBe('w');
	});
});
