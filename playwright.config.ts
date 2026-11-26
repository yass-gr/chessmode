import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	use: {
		baseURL: 'http://127.0.0.1:4370',
		actionTimeout: 10_000,
		launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } }],
	webServer: {
		command: 'npx vite build && npx vite preview --port 4370 --strictPort --host 127.0.0.1',
		url: 'http://127.0.0.1:4370',
		timeout: 120_000,
		reuseExistingServer: !process.env.CI
	}
});
