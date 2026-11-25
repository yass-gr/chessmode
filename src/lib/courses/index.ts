import type { CourseFile } from '#lib/courses/types.ts';
import { lazyCourse } from '#lib/courses/parse.ts';

const files = import.meta.glob<CourseFile>('./*.json', { eager: true, import: 'default' });
export const courses = Object.values(files).map(lazyCourse);
export const getCourse = (id: string | undefined) => courses.find(course => course.id === id);
