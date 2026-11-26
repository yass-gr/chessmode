import { defineConfig, devices } from '@playwright/test';

const chromium = process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {};

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	workers: 1,
	retries: 0,
	timeout: 90_000,
	expect: { timeout: 15_000 },
	use: {
		baseURL: 'http://127.0.0.1:4360',
		actionTimeout: 15_000,
		launchOptions: chromium,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	projects: [
		{ name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', viewport: { width: 390, height: 844 } } },
		{ name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 768 } } },
		{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }
	],
	webServer: {
		command: 'node scripts/e2e-server.mjs',
		url: 'http://127.0.0.1:4360/',
		timeout: 60_000,
		reuseExistingServer: false,
		stdout: 'pipe',
		stderr: 'pipe'
	}
});
