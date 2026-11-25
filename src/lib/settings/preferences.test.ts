import { describe, expect, it } from 'vitest';
import { parsePreferences, parseCoursePreferences, shouldSkipSharedStart, showEvaluation, opponentDelay } from './preferences.ts';

describe('trainer preferences', () => {
 it('validates stored values and preserves the old mute setting', () => { const p = parsePreferences({ theme: 'invalid', textSize: 'large' }, true); expect(p.theme).toBe('default'); expect(p.textSize).toBe('large'); expect(p.sound).toBe(false); });
 it('keeps course defaults independent', () => { expect(parseCoursePreferences({ fastOpponent: false })).toEqual({ fastOpponent: false, skipSharedStart: false }); });
 it('only skips a usable shared opening', () => { const args = { mode: 'learn' as const, enabled: true, lineCount: 2, sharedPlies: 2, playerMovesAfter: 1, firstLearn: false }; expect(shouldSkipSharedStart(args)).toBe(true); expect(shouldSkipSharedStart({ ...args, firstLearn: true })).toBe(false); expect(shouldSkipSharedStart({ ...args, playerMovesAfter: 0 })).toBe(false); expect(shouldSkipSharedStart({ ...args, mode: 'time' })).toBe(false); });
 it('applies mode-specific evaluation and pace', () => { expect(showEvaluation('puzzles', parsePreferences(null))).toBe(false); expect(opponentDelay('drill', parseCoursePreferences({ fastOpponent: false }))).toBe(500); });
});
