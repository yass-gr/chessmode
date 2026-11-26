import type { TrainerMode } from '#lib/train/types.ts';
import type { HintStage } from '#lib/train/types.ts';
import type { Preferences } from '#lib/settings/types.ts';

export function coachOpen(args: {
	mode: TrainerMode;
	coaching: Preferences['coaching'];
	requested: boolean;
	explanatory: boolean;
}): boolean {
	if (args.coaching === 'tap') return args.requested;
	if (args.coaching === 'always') return true;
	return args.mode === 'learn' || args.explanatory;
}

/** Arrows follow the setting only once the move is allowed to be seen. A fix hides the answer until asked. */
export function arrowFor(args: {
	setting: Preferences['arrows'];
	hint: HintStage;
	coachOpen: boolean;
	hideAnswer: boolean;
	forced?: boolean;
}): 'none' | 'source' | 'full' {
	if (args.forced && args.hint === 'move') return 'full';
	if (args.hideAnswer) return args.hint === 'source' ? 'source' : args.hint === 'move' ? 'full' : 'none';
	if (args.setting === 'none') return 'none';
	if (args.hint === 'source') return 'source';
	if (args.hint !== 'move') return 'none';
	if (args.setting === 'always') return 'full';
	return args.coachOpen ? 'full' : 'none';
}
