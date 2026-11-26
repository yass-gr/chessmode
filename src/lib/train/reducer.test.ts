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
		expect(run.state).toMatchObject({ kind: 'student', hint: 'move' });
		run = step(run, { type: 'studentMoved', uci: 'e2e4' as Uci });
		expect(run.state.kind).toBe('opponent');
		expect(run.points).toBe(1);
		run = step(run, { type: 'opponentPlayed' });
		run = step(run, { type: 'studentMoved', uci: 'g1f3' as Uci });
		expect(run.state).toMatchObject({ kind: 'done', points: 2 });
	});

	it('steps a source hint before the full move and counts that help once', () => {
		let run = startLine(line, 'practice');
		expect(run.state).toMatchObject({ kind: 'student', hint: 'none' });
		run = step(run, { type: 'hint' });
		expect(run).toMatchObject({ hints: 1, state: { hint: 'source' } });
		run = step(run, { type: 'hint' });
		expect(run).toMatchObject({ hints: 1, state: { hint: 'move' } });
		run = step(run, { type: 'studentMoved', uci: 'e2e4' as Uci });
		expect(run.points).toBe(0);
	});

	it('keeps a wrong move until takeback and does not count the same ply twice', () => {
		let run = startLine(line, 'practice');
		run = step(run, { type: 'studentMoved', uci: 'd2d4' as Uci });
		expect(run).toMatchObject({ mistakes: 1, state: { kind: 'wrong', played: 'd2d4' } });
		run = step(run, { type: 'retry' });
		run = step(run, { type: 'studentMoved', uci: 'd2d4' as Uci });
		expect(run.mistakes).toBe(1);
		expect(step(run, { type: 'retry' }).state.kind).toBe('student');
	});

	it('replays the missed sequence in a fix and then continues', () => {
		let run = startLine(line, 'practice');
		run = step(run, { type: 'studentMoved', uci: 'e2e4' as Uci });
		run = step(run, { type: 'opponentPlayed' });
		run = step(run, { type: 'studentMoved', uci: 'b1c3' as Uci });
		expect(run.state).toMatchObject({ kind: 'wrong', index: 2 });
		run = step(run, { type: 'fix' });
		expect(run.state).toMatchObject({ kind: 'fix', index: 0, hint: 'move' });
		run = step(run, { type: 'studentMoved', uci: 'e2e4' as Uci });
		expect(run.points).toBe(1);
		run = step(run, { type: 'opponentPlayed' });
		expect(run.state).toMatchObject({ kind: 'fix', index: 2, hint: 'none' });
		run = step(run, { type: 'studentMoved', uci: 'g1f3' as Uci });
		expect(run.state.kind).toBe('done');
		expect(run.points).toBe(2);
	});

	it('ignores a move while history is open and resumes at the live ply', () => {
		let run = step(startLine(line, 'practice'), { type: 'studentMoved', uci: 'e2e4' as Uci });
		run = step(run, { type: 'browse', index: 0 });
		expect(run.view).toBe(0);
		const parked = step(run, { type: 'opponentPlayed' });
		expect(parked.state.kind).toBe('opponent');
		expect(step(parked, { type: 'resume' }).view).toBeNull();
	});

	it('shows the expected move on a time rollback without charging another hint', () => {
		let run = startLine(line, 'time');
		run = step(run, { type: 'studentMoved', uci: 'd2d4' as Uci });
		run = step(run, { type: 'reveal' });
		run = step(run, { type: 'retry' });
		expect(run).toMatchObject({ hints: 0, mistakes: 1, state: { kind: 'student', hint: 'move' } });
	});

	it('keeps a drill going after a mistake', () => {
		const run = step(startLine(line, 'drill'), { type: 'studentMoved', uci: 'd2d4' as Uci });
		expect(run.state.kind).toBe('wrong');
		expect(run.mistakes).toBe(1);
	});
});
