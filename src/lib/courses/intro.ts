import type { Intro } from '#lib/components/courses/CourseIntro.svelte';

const files = import.meta.glob<Intro>('./intros/*.json', { eager: true, import: 'default' });

/** An optional author intro. Courses without a recording keep the Ideas tab as the introduction. */
export function courseIntro(id: string): Intro | undefined {
	const intro = Object.entries(files).find(([path]) => path.endsWith(`/${id}.json`))?.[1];
	if (!intro || typeof intro.title !== 'string' || typeof intro.video !== 'string' || !intro.title || !intro.video) return;
	return intro;
}
