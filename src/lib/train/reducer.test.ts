import { describe, expect, it } from 'vitest';
import { parseCourse } from '#lib/courses/parse.ts';
import type { CourseFile } from '#lib/courses/types.ts';
import type { Uci } from '#lib/chess/types.ts';
import fixture from '#lib/courses/fixtures/test-course.json';
import { startLine, step } from './reducer.ts';

const line = parseCourse({ ...fixture, side: 'w' } satisfies CourseFile).lines[0];
describe('trainer', () => {
	it('reveals learning moves and advances through replies', () => {
		let run = startLine(line, 'learn');
		expect(run.state).toMatchObject({ kind: 'student', revealed: true });
		run = step(run, { type: 'studentMoved', uci: 'e2e4' as Uci });
		expect(run.state.kind).toBe('opponent');
		run = step(run, { type: 'opponentPlayed' });
		run = step(run, { type: 'studentMoved', uci: 'g1f3' as Uci });
		expect(run.state.kind).toBe('done');
	});
	it.each(['practice', 'time'] as const)('%s counts mistakes and hints', mode => {
		let run = startLine(line, mode);
		run = step(run, { type: 'hint' });
		run = step(run, { type: 'studentMoved', uci: 'd2d4' as Uci });
		expect(run).toMatchObject({ mistakes: 1, hints: 1, state: { kind: 'wrong' } });
		expect(step(run, { type: 'retry' }).state).toMatchObject({ kind: 'student', revealed: true });
	});
	it('ends a drill on the first mistake', () => {
		const run = step(startLine(line, 'drill'), { type: 'studentMoved', uci: 'd2d4' as Uci });
		expect(run.state).toMatchObject({ kind: 'done', mistakes: 1 });
	});
});
