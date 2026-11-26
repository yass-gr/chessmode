import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

// Cross-origin isolation lets the multi-threaded Stockfish build use SharedArrayBuffer.
// Production sets the same headers in static/_headers (Cloudflare Pages).
const isolation = {
	'Cross-Origin-Opener-Policy': 'same-origin',
	'Cross-Origin-Embedder-Policy': 'require-corp'
};

const crossOriginIsolation: Plugin = {
	name: 'cross-origin-isolation',
	configureServer: (server) => {
		server.middlewares.use((_req, res, next) => {
			for (const [k, v] of Object.entries(isolation)) res.setHeader(k, v);
			next();
		});
	},
	configurePreviewServer: (server) => {
		server.middlewares.use((_req, res, next) => {
			for (const [k, v] of Object.entries(isolation)) res.setHeader(k, v);
			next();
		});
	}
};

export default defineConfig({
	plugins: [
		crossOriginIsolation,
		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: 'index.html' }),
			serviceWorker: { register: false },
			// The SPA fallback is served at every depth, so asset URLs must not be relative.
			paths: { relative: false }
		})
	]
});
