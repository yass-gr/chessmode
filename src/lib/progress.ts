import { db, dayKey, type SessionLog } from '#lib/db.ts';

export async function logSession(session: Omit<SessionLog, 'id' | 'at' | 'day' | 'xp'> & { at?: number; correct?: number }): Promise<void> {
	const { correct, ...rest } = session;
	const at = session.at ?? Date.now();
	const xp = session.mode === 'learn' ? 10 : session.mode === 'practice' ? 5 * session.lines : session.mode === 'quiz' ? 3 * (correct ?? 0) : session.mode === 'drill' || session.mode === 'time' || session.mode === 'puzzles' ? 2 * session.lines : session.mode === 'arena' ? 8 * session.lines : 0;
	await db.sessions.add({ ...rest, at, day: dayKey(at), xp });
}
export function streak(days: string[], now = new Date()): number {
	const active = new Set(days);
	const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	if (!active.has(dayKey(date.getTime()))) date.setDate(date.getDate() - 1);
	let count = 0;
	while (active.has(dayKey(date.getTime()))) { count++; date.setDate(date.getDate() - 1); }
	return count;
}
