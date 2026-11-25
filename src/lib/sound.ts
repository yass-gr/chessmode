import { getSetting, setSetting } from '#lib/db.ts';

export type Cue = 'move' | 'capture' | 'correct' | 'wrong' | 'complete';

let ctx: AudioContext | undefined;
let muted = false;
getSetting('muted', false).then((m) => (muted = m));

export const isMuted = () => muted;
export async function setMuted(value: boolean) {
	muted = value;
	await setSetting('muted', value);
}

/** Notes as [frequency Hz, start s, length s, gain]. Short synthesized cues, no audio files to ship. */
const CUES: Record<Cue, [number, number, number, number][]> = {
	move: [[180, 0, 0.05, 0.12]],
	capture: [
		[140, 0, 0.06, 0.16],
		[90, 0.02, 0.07, 0.1]
	],
	correct: [
		[660, 0, 0.08, 0.05],
		[990, 0.06, 0.12, 0.04]
	],
	wrong: [
		[220, 0, 0.12, 0.06],
		[180, 0.08, 0.16, 0.05]
	],
	complete: [
		[523, 0, 0.12, 0.05],
		[659, 0.1, 0.12, 0.05],
		[784, 0.2, 0.22, 0.05]
	]
};

export function play(cue: Cue) {
	if (muted || typeof AudioContext === 'undefined') return;
	ctx ??= new AudioContext();
	if (ctx.state === 'suspended') void ctx.resume();
	const t0 = ctx.currentTime;
	for (const [freq, start, len, gain] of CUES[cue]) {
		const osc = ctx.createOscillator();
		const g = ctx.createGain();
		osc.type = cue === 'move' || cue === 'capture' ? 'triangle' : 'sine';
		osc.frequency.value = freq;
		g.gain.setValueAtTime(0.0001, t0 + start);
		g.gain.exponentialRampToValueAtTime(gain, t0 + start + 0.008);
		g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + len);
		osc.connect(g).connect(ctx.destination);
		osc.start(t0 + start);
		osc.stop(t0 + start + len + 0.02);
	}
}
