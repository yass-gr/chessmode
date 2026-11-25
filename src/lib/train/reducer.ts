import type { Line } from '#lib/courses/types.ts';
import type { LineRun, TrainerEvent, TrainerMode, TrainerState } from '#lib/train/types.ts';

function at(line: Line, index: number, mode: TrainerMode, mistakes: number, hints: number): TrainerState {
	const ply = line.plies[index];
	if (!ply) return { kind: 'done', mistakes, hints };
	return ply.student ? { kind: 'student', index, revealed: mode === 'learn' } : { kind: 'opponent', index };
}

export function startLine(line: Line, mode: TrainerMode): LineRun {
	return { line, mode, mistakes: 0, hints: 0, state: at(line, 0, mode, 0, 0) };
}

export function step(run: LineRun, event: TrainerEvent): LineRun {
	const state = run.state;
	if (state.kind === 'done') return run;
	if (event.type === 'opponentPlayed' && state.kind === 'opponent')
		return { ...run, state: at(run.line, state.index + 1, run.mode, run.mistakes, run.hints) };
	if (event.type === 'hint' && state.kind === 'student' && !state.revealed)
		return { ...run, hints: run.hints + 1, state: { ...state, revealed: true } };
	if (event.type === 'retry' && state.kind === 'wrong')
		return { ...run, state: { kind: 'student', index: state.index, revealed: true } };
	if (event.type === 'studentMoved' && state.kind === 'student') {
		if (event.uci === run.line.plies[state.index].uci)
			return { ...run, state: at(run.line, state.index + 1, run.mode, run.mistakes, run.hints) };
		const mistakes = run.mistakes + 1;
		return { ...run, mistakes, state: run.mode === 'drill'
			? { kind: 'done', mistakes, hints: run.hints }
			: { kind: 'wrong', index: state.index, played: event.uci, revealed: true } };
	}
	return run;
}
