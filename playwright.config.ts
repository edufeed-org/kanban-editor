import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	
	fullyParallel: true,
	
	forbidOnly: !!process.env.CI,
	
	retries: process.env.CI ? 2 : 0,
	
	workers: process.env.CI ? 1 : undefined,
	
	reporter: [
		['html'],
		['json', { outputFile: 'test-results/results.json' }],
		['junit', { outputFile: 'test-results/results.xml' }]
	],
	
	use: {
		/* Base URL to use in actions like `await page.goto('/')`. */
		baseURL: 'http://127.0.0.1:4173',
		
		trace: 'on-first-retry',
		
		screenshot: 'only-on-failure',

		video: 'retain-on-failure',
		
		actionTimeout: 10000,
		navigationTimeout: 30000,
	},

	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},

		// TODO: unfortunately, we should test just one browser for now because it is
		// creating a lot of boards what make some test fail. Uncomment when a app handles 
		// it more smoothly.
		// {
		// 	name: 'firefox',
		// 	use: { ...devices['Desktop Firefox'] },
		// },

		// {
		// 	name: 'webkit',
		// 	use: { ...devices['Desktop Safari'] },
		// },

		// TODO: Uncomment when mobile view is optimized
		// {
		// 	name: 'Mobile Chrome',
		// 	use: { ...devices['Pixel 5'] },
		// },
	],

	webServer: {
		command: 'pnpm preview:ci',
		port: 4173,
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000,
		stdout: 'pipe',
  		stderr: 'pipe'
	},
	timeout: 30 * 1000,
	globalTimeout: 600 * 1000,
	
	expect: {
		timeout: 5000,
	},
});
