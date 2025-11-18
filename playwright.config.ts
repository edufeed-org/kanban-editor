import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	
	/* Run tests in files in parallel */
	fullyParallel: true,
	
	/* Fail the build on CI if you accidentally left test.only in the source code. */
	forbidOnly: !!process.env.CI,
	
	/* Retry on CI only */
	retries: process.env.CI ? 2 : 0,
	
	/* Opt out of parallel tests on CI. */
	workers: process.env.CI ? 1 : undefined,
	
	/* Reporter to use. See https://playwright.dev/docs/test-reporters */
	reporter: [
		['html'],
		['json', { outputFile: 'test-results/results.json' }],
		['junit', { outputFile: 'test-results/results.xml' }]
	],
	
	/* Shared settings for all the projects below. */
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL: 'http://127.0.0.1:4173',
		
		/* Collect trace when retrying the failed test. */
		trace: 'on-first-retry',
		
		/* Screenshot on failure */
		screenshot: 'only-on-failure',
		
		/* Video recording for debugging */
		video: 'retain-on-failure',
		
		/* Global test timeout */
		actionTimeout: 10000,
		navigationTimeout: 30000,
	},

	/* Configure projects for major browsers */
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},

		{
			name: 'firefox',
			use: { ...devices['Desktop Firefox'] },
		},

		{
			name: 'webkit',
			use: { ...devices['Desktop Safari'] },
		},

		/* Test against mobile viewports. */
		{
			name: 'Mobile Chrome',
			use: { ...devices['Pixel 5'] },
		},
	],

	webServer: {
		command: 'pnpm preview:ci',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000 // 2 minutes for build + server startup
	},
	
	/* Global test configuration */
	timeout: 30 * 1000, // 30 seconds per test
	globalTimeout: 600 * 1000, // 10 minutes for entire test suite
	
	/* Expect configuration */
	expect: {
		timeout: 5000, // 5 seconds for assertions
	},
});
