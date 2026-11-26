export function plural(count: number, singular: string): string {
	return count === 1 ? singular : `${singular}s`;
}
