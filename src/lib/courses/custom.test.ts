import { describe, expect, it } from 'vitest';
import { buildCourse, readPgnTree } from '#lib/courses/pgn-tree.ts';
import { copyCourse, diffReimport } from '#lib/courses/custom.ts';

const fileFor = (pgn: string) => buildCourse(readPgnTree(pgn).tree, { id: 'custom-test', name: 'Test', side: 'w' }).file;

describe('diffReimport', () => {
	it('treats a shorter shared prefix as a change and an unrelated line as added and removed', () => {
		const previous = fileFor('1. e4 e5 2. Nf3 Nc6 *');
		const next = fileFor('1. e4 e5 2. Bc4 *');
		const report = diffReimport(previous, next, ['custom-test/line-1']);
		expect(report.changed[0].previousName).toBe(previous.chapters[0].lines[0].name);
		expect(report.progressKept).toBe(0);
		expect(report.progressTotal).toBe(1);
	});

	it('gives a copy its own name and chapters', () => {
		const file = fileFor('1. e4 e5 *');
		const copy = copyCourse(file, 'custom-copy');
		expect(copy.id).toBe('custom-copy');
		expect(copy.name).toBe('Test copy');
		expect(copy.chapters).not.toBe(file.chapters);
		expect(copy.chapters[0].lines[0].pgn).toBe(file.chapters[0].lines[0].pgn);
	});
});
