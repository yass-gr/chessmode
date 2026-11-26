import type { Line } from '#lib/courses/types.ts';
import type { HintStage, LineRun, TrainerEvent, TrainerMode, TrainerState } from '#lib/train/types.ts';

function at(line: Line, index: number, mode: TrainerMode, mistakes: number, hints: number, points: number): TrainerState {
	const ply = line.plies[index];
	if (!ply) return { kind: 'done', mistakes, hints, points };
	const hint: HintStage = mode === 'learn' ? 'move' : 'none';
	return ply.student ? { kind: 'student', index, hint } : { kind: 'opponent', index };
}

export function startLine(line: Line, mode: TrainerMode, origin = 0): LineRun {
	const index = Math.max(0, Math.min(origin, line.plies.length));
	return {
		line,
		mode,
		mistakes: 0,
		hints: 0,
		points: 0,
		mistakeAt: [],
		hintAt: [],
		scoredAt: [],
		origin: index,
		view: null,
		state: at(line, index, mode, 0, 0, 0)
	};
}

function withMistake(run: LineRun, index: number): LineRun {
	if (run.mistakeAt.includes(index)) return run;
	return { ...run, mistakes: run.mistakes + 1, mistakeAt: [...run.mistakeAt, index] };
}

function withHint(run: LineRun, index: number): LineRun {
	if (run.hintAt.includes(index)) return run;
	return { ...run, hints: run.hints + 1, hintAt: [...run.hintAt, index] };
}

function scoreMove(run: LineRun, index: number): LineRun {
	if (run.scoredAt.includes(index) || run.hintAt.includes(index)) return { ...run, scoredAt: run.scoredAt.includes(index) ? run.scoredAt : [...run.scoredAt, index] };
	return { ...run, points: run.points + 1, scoredAt: [...run.scoredAt, index] };
}

function advance(run: LineRun, index: number): LineRun {
	return { ...run, state: at(run.line, index, run.mode, run.mistakes, run.hints, run.points) };
}

function liveIndex(run: LineRun): number {
	const state = run.state;
	if (state.kind === 'done') return run.line.plies.length;
	return state.index;
}

export function step(run: LineRun, event: TrainerEvent): LineRun {
	if (event.type === 'browse') {
		const live = liveIndex(run);
		if (event.index < 0 || event.index > live) return run;
		return { ...run, view: event.index === live ? null : event.index };
	}
	if (event.type === 'resume') return { ...run, view: null };
	if (run.view !== null) return run;

	const state = run.state;
	if (state.kind === 'done') return run;

	if (event.type === 'opponentPlayed' && (state.kind === 'opponent' || state.kind === 'fix')) {
		const next = state.index + 1;
		if (state.kind === 'fix') return stepFix(run, next, state.resume);
		return advance(run, next);
	}

	if (event.type === 'hint' && (state.kind === 'student' || state.kind === 'wrong' || state.kind === 'fix')) {
		if (state.hint === 'move') return run;
		const hinted = state.hint === 'none' ? withHint(run, state.index) : run;
		const hint: HintStage = state.hint === 'none' ? 'source' : 'move';
		return { ...hinted, state: { ...state, hint } };
	}

	if (event.type === 'reveal' && (state.kind === 'wrong' || state.kind === 'student' || state.kind === 'fix'))
		return { ...run, state: { ...state, hint: 'move' } };

	if (event.type === 'retry' && state.kind === 'wrong')
		return { ...run, state: { kind: 'student', index: state.index, hint: state.hint } };

	if (event.type === 'fix' && (state.kind === 'wrong' || state.kind === 'student'))
		return { ...run, view: null, state: { kind: 'fix', index: run.origin, resume: state.index, hint: run.origin === state.index ? 'none' : 'move' } };

	if (event.type === 'studentMoved' && (state.kind === 'student' || state.kind === 'fix')) {
		const expected = run.line.plies[state.index]?.uci;
		if (!expected) return run;
		if (event.uci === expected) {
			const scored = scoreMove(run, state.index);
			const next = state.index + 1;
			if (state.kind === 'fix') return stepFix(scored, next, state.resume);
			return advance(scored, next);
		}
		if (state.kind === 'fix') return withMistake(run, state.index);
		const missed = withMistake(run, state.index);
		return { ...missed, state: { kind: 'wrong', index: state.index, played: event.uci, hint: state.hint } };
	}

	return run;
}

function stepFix(run: LineRun, index: number, resume: number): LineRun {
	if (index > resume) return advance(run, index);
	const ply = run.line.plies[index];
	if (!ply) return advance(run, index);
	const hint: HintStage = index === resume ? 'none' : ply.student ? 'move' : 'none';
	return { ...run, state: { kind: 'fix', index, resume, hint } };
}
