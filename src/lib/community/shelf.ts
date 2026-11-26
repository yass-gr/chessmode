import type { Course } from '#lib/courses/types.ts';

/** The shipped courses a guest can open. Publishing a private repertoire is a separate account question. */
export interface CommunityCourse {
	id: string;
	name: string;
	tagline: string;
	side: 'w' | 'b';
	lines: number;
	href: string;
}

export function communityShelf(courses: readonly Course[]): CommunityCourse[] {
	return courses.map((course) => {
		const line = course.lines[0];
		return {
			id: course.id,
			name: course.name,
			tagline: course.tagline,
			side: course.side,
			lines: course.lines.length,
			href: line ? `/learn/${course.id}/${line.id}` : `/course/${course.id}`
		};
	});
}
