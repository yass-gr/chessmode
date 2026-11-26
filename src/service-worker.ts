import { version } from '$app/env';
import { assets, immutable } from '$app/manifest';
import { self as sw } from '$app/service-worker';

const CACHE = `chessmode-${version}`;
const SHELL = '/';
const PRECACHE = [
	SHELL,
	...immutable.map((f) => f.path),
	...assets.map((f) => f.path).filter((path) => !/(_headers|robots\.txt|COPYING\.txt)$/.test(path))
];

sw.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(PRECACHE))
			.then(() => sw.skipWaiting())
	);
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

async function respond(request: Request): Promise<Response> {
	const cache = await caches.open(CACHE);

	if (request.mode === 'navigate') {
		try {
			const fresh = await fetch(request);
			if (fresh.ok) return fresh;
		} catch {
			// Offline: the SPA shell renders every route.
		}
		return (await cache.match(SHELL)) ?? Response.error();
	}

	// Key on the full URL. Vite serves the component and its CSS from one path with different queries.
	const hit = await cache.match(request);
	if (hit) return hit;
	const fresh = await fetch(request);
	if (fresh.ok && fresh.type === 'basic') void cache.put(request, fresh.clone());
	return fresh;
}

sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (event.request.method !== 'GET' || url.origin !== sw.location.origin) return;
	event.respondWith(respond(event.request));
});
