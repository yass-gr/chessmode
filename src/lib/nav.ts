export const tabs = [
	{ href: '/', label: 'Learn', prefixes: ['/', '/course', '/courses', '/learn', '/quiz', '/onboarding', '/create'] },
	{ href: '/practice', label: 'Practice', prefixes: ['/practice'] },
	{ href: '/drill', label: 'Drill', prefixes: ['/drill', '/arena', '/bots', '/endgames', '/puzzles', '/books', '/community'] },
	{ href: '/matches', label: 'Matches', prefixes: ['/matches', '/review', '/explorer', '/analysis', '/opening-review'] },
	{ href: '/you', label: 'You', prefixes: ['/you'] }
];

export function tabForPath(pathname: string) {
	return tabs.find((tab) => tab.prefixes.some((prefix) => prefix === '/' ? pathname === '/' : pathname === prefix || pathname.startsWith(prefix + '/')));
}
