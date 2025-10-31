import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: {
		command: 'npm run build && npm run preview',
		port: 4173,
		reuseExistingServer: false,
		timeout: 120 * 1000 // 2 Minuten für Server-Startup/Shutdown
	},
	testDir: 'e2e',
	timeout: 30 * 1000, // Test Timeout
	globalTimeout: 600 * 1000 // Globales Timeout für alle Tests
});
