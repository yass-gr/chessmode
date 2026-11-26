/**
 * Preview server for Playwright.
 *
 * Vite treats stdin "end" as the parent dying and calls process.exit(), unless CI is set.
 * Playwright keeps the web server on a pipe, so that handler stops the server mid-suite
 * and later projects see connection refused. Setting CI here only affects this process.
 */
process.env.CI = 'true';

import { existsSync } from 'node:fs';
import { preview } from 'vite';

if (!existsSync('build/index.html')) {
	console.error('Missing build/index.html. Run vite build before the end-to-end server.');
	process.exit(1);
}

const host = '127.0.0.1';
const port = 4360;
let stopping = false;

process.stdin.resume();
process.stdin.on('end', () => {
	console.error('Preview stdin closed; keeping the server up.');
});

const server = await preview({
	preview: { host, port, strictPort: true }
});

console.log(`e2e preview http://${host}:${port}`);

async function shutdown() {
	if (stopping) return;
	stopping = true;
	await server.close();
	process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

server.httpServer.on('close', () => {
	if (!stopping) {
		console.error('Preview stopped listening unexpectedly.');
		process.exit(1);
	}
});
