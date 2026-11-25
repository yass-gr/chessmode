import type { Course, Line, LineKey } from '#lib/courses/types.ts';
import type { LineProgress } from '#lib/db.ts';
import { depthData } from '#lib/courses/depth-data.ts';

export interface DepthChoice {
 tier: number;
 seen: boolean;
 pinned: LineKey[];
}
export interface DepthTier { name: string; count: number }
export interface CourseScope {
 tiers: DepthTier[];
 tier: number;
 lines: Line[];
 beyond: Line[];
 total: number;
 learned: number;
 perfected: number;
 next?: Line;
}
export const defaultDepth = (): DepthChoice => ({ tier: 0, seen: false, pinned: [] });

export function courseScope(course: Course, choice: DepthChoice, progress: ReadonlyMap<LineKey, LineProgress>): CourseScope {
 const data = depthData[course.id];
 const byId = new Map(course.lines.map(line => [line.id, line]));
 const valid = data && data.order.length === course.lines.length && new Set(data.order).size === course.lines.length && data.order.every(id => byId.has(id)) && data.counts.length >= 2 && data.counts.every((count, i) => count > (data.counts[i - 1] ?? 0) && count <= course.lines.length) && data.counts.at(-1) === course.lines.length;
 const ordered = valid ? data.order.flatMap(id => { const line = byId.get(id); return line ? [line] : []; }) : course.lines;
 const counts = valid ? data.counts : [course.lines.length];
 const names = counts.length === 3 ? ['Essentials', 'Advanced', 'Full Mastery'] : counts.length === 2 ? ['Essentials', 'Full Mastery'] : ['Full course'];
 const tiers = counts.map((count, i) => ({ name: names[i], count }));
 const tier = Math.max(0, Math.min(Number.isInteger(choice.tier) ? choice.tier : 0, tiers.length - 1));
 const selected = new Set(ordered.slice(0, counts[tier]).map(line => line.key));
 for (const key of choice.pinned) if (course.lines.some(line => line.key === key)) selected.add(key);
 const lines = ordered.filter(line => selected.has(line.key));
 return { tiers, tier, lines, beyond: ordered.filter(line => !selected.has(line.key)), total: lines.length, learned: lines.filter(line => progress.has(line.key)).length, perfected: lines.filter(line => progress.get(line.key)?.clean).length, next: lines.find(line => !progress.has(line.key)) };
}
