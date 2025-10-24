<script lang="ts">
	import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	let testResults: { test: string; status: 'pass' | 'fail'; message: string }[] = [];

	// Test 1: Settings laden
	function test1() {
		try {
			const settings = settingsStore.settings;
			const isDark = settingsStore.isDarkMode;
			const isLlm = settingsStore.isLlmConfigured;

			if (settings && isDark !== undefined && isLlm !== undefined) {
				testResults = [
					...testResults,
					{
						test: '1. Settings laden',
						status: 'pass',
						message: `✅ Settings geladen: ${JSON.stringify(settings).substring(0, 50)}...`
					}
				];
			} else {
				throw new Error('Settings sind undefined');
			}
		} catch (error) {
			testResults = [
				...testResults,
				{
					test: '1. Settings laden',
					status: 'fail',
					message: `❌ Fehler: ${error}`
				}
			];
		}
	}

	// Test 2: maxCardsBeforeScroll ändern
	function test2() {
		try {
			const before = settingsStore.settings.maxCardsBeforeScroll;
			settingsStore.setMaxCardsBeforeScroll(15);
			const after = settingsStore.settings.maxCardsBeforeScroll;

			if (after === 15) {
				testResults = [
					...testResults,
					{
						test: '2. maxCardsBeforeScroll ändern',
						status: 'pass',
						message: `✅ Von ${before} zu ${after} geändert`
					}
				];
			} else {
				throw new Error(`Erwartet 15, aber ${after}`);
			}
		} catch (error) {
			testResults = [
				...testResults,
				{
					test: '2. maxCardsBeforeScroll ändern',
					status: 'fail',
					message: `❌ Fehler: ${error}`
				}
			];
		}
	}

	// Test 3: localStorage überprüfen
	function test3() {
		try {
			const stored = localStorage.getItem('kanban-settings');
			if (stored) {
				const parsed = JSON.parse(stored);
				testResults = [
					...testResults,
					{
						test: '3. localStorage Persistierung',
						status: 'pass',
						message: `✅ localStorage hat ${Object.keys(parsed).length} Einträge`
					}
				];
			} else {
				throw new Error('Nichts in localStorage gespeichert');
			}
		} catch (error) {
			testResults = [
				...testResults,
				{
					test: '3. localStorage Persistierung',
					status: 'fail',
					message: `❌ Fehler: ${error}`
				}
			];
		}
	}

	// Test 4: Theme ändern
	function test4() {
		try {
			const before = settingsStore.settings.theme;
			const newTheme = before === 'dark' ? 'default' : 'dark';
			settingsStore.setTheme(newTheme);
			const after = settingsStore.settings.theme;

			if (after === newTheme) {
				testResults = [
					...testResults,
					{
						test: '4. Theme wechsel',
						status: 'pass',
						message: `✅ Von "${before}" zu "${after}" geändert`
					}
				];
			} else {
				throw new Error(`Erwartet ${newTheme}, aber ${after}`);
			}
		} catch (error) {
			testResults = [
				...testResults,
				{
					test: '4. Theme wechsel',
					status: 'fail',
					message: `❌ Fehler: ${error}`
				}
			];
		}
	}

	// Test 5: Relay hinzufügen
	function test5() {
		try {
			const beforeCount = settingsStore.settings.relaysPublic.length;
			// Nutze eine wirklich eindeutige Test-URL mit Timestamp
			const testUrl = `wss://test-relay-${Date.now()}.example.com`;
			console.log('🔍 Test 5: Adding relay:', testUrl);
			console.log('  Before count:', beforeCount);
			console.log('  Current relays:', settingsStore.settings.relaysPublic);
			
			settingsStore.addRelayPublic(testUrl);
			
			const afterCount = settingsStore.settings.relaysPublic.length;
			console.log('  After count:', afterCount);
			console.log('  New relays:', settingsStore.settings.relaysPublic);

			if (afterCount > beforeCount) {
				testResults = [
					...testResults,
					{
						test: '5. Relay hinzufügen',
						status: 'pass',
						message: `✅ Relay hinzugefügt: ${beforeCount} → ${afterCount} Relays`
					}
				];
			} else {
				throw new Error(`Count nicht erhöht: ${beforeCount} → ${afterCount}`);
			}
		} catch (error) {
			testResults = [
				...testResults,
				{
					test: '5. Relay hinzufügen',
					status: 'fail',
					message: `❌ Fehler: ${error}`
				}
			];
		}
	}

	// Test 6: Settings exportieren
	function test6() {
		try {
			const exported = settingsStore.exportSettings();
			if (exported && Object.keys(exported).length > 0) {
				testResults = [
					...testResults,
					{
						test: '6. Settings exportieren',
						status: 'pass',
						message: `✅ Exportiert mit ${Object.keys(exported).length} Eigenschaften`
					}
				];
			} else {
				throw new Error('Export ist leer');
			}
		} catch (error) {
			testResults = [
				...testResults,
				{
					test: '6. Settings exportieren',
					status: 'fail',
					message: `❌ Fehler: ${error}`
				}
			];
		}
	}

	// Alle Tests ausführen
	function runAllTests() {
		testResults = [];
		test1();
		test2();
		test3();
		test4();
		test5();
		test6();
	}

	// Settings Debug ausgeben
	function debugPrint() {
		settingsStore.debugPrintSettings();
	}
</script>

<div class="p-8 max-w-4xl mx-auto">
	<h1 class="text-3xl font-bold mb-6">⚙️ SettingsStore Test Suite</h1>

	<!-- Buttons -->
	<div class="flex gap-4 mb-8">
		<Button onclick={runAllTests} class="bg-green-600 hover:bg-green-700">
			🚀 Alle Tests ausführen
		</Button>
		<Button onclick={debugPrint} variant="outline">
			🔍 Debug Ausgabe
		</Button>
		<Button
			onclick={() => (testResults = [])}
			variant="outline"
		>
			🗑️ Ergebnisse löschen
		</Button>
	</div>

	<!-- Test Results -->
	{#if testResults.length > 0}
		<div class="space-y-3">
			<h2 class="text-xl font-semibold mb-4">Test Ergebnisse:</h2>

			{#each testResults as result (result.test)}
				<Card.Root
					class={result.status === 'pass'
						? 'border-green-400 bg-green-50'
						: 'border-red-400 bg-red-50'}
				>
					<Card.Content class="pt-6">
						<div class="font-semibold text-sm mb-2">{result.test}</div>
						<div class="text-sm">{result.message}</div>
					</Card.Content>
				</Card.Root>
			{/each}

			<!-- Summary -->
			<div class="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
				<div class="text-sm font-semibold">
					✅ Passed: {testResults.filter((r) => r.status === 'pass').length} / {testResults.length}
				</div>
			</div>
		</div>
	{/if}

	<!-- Individual Test Buttons -->
	<div class="mt-8 pt-6 border-t">
		<h2 class="text-lg font-semibold mb-4">Einzelne Tests:</h2>
		<div class="grid grid-cols-2 gap-3">
			<Button onclick={test1} variant="outline">Test 1: Settings laden</Button>
			<Button onclick={test2} variant="outline">Test 2: maxCards ändern</Button>
			<Button onclick={test3} variant="outline">Test 3: localStorage</Button>
			<Button onclick={test4} variant="outline">Test 4: Theme wechsel</Button>
			<Button onclick={test5} variant="outline">Test 5: Relay add</Button>
			<Button onclick={test6} variant="outline">Test 6: Export</Button>
		</div>
	</div>

	<!-- Current Settings Display -->
	<div class="mt-8 pt-6 border-t">
		<h2 class="text-lg font-semibold mb-4">📍 Aktuelle Settings:</h2>
		<Card.Root>
			<Card.Content class="pt-6">
				<div class="space-y-2 text-sm">
					<div>
						<span class="font-semibold">Theme:</span>
						<span class="ml-2">{settingsStore.settings.theme}</span>
					</div>
					<div>
						<span class="font-semibold">isDarkMode:</span>
						<span class="ml-2">{settingsStore.isDarkMode}</span>
					</div>
					<div>
						<span class="font-semibold">maxCardsBeforeScroll:</span>
						<span class="ml-2">{settingsStore.settings.maxCardsBeforeScroll}</span>
					</div>
					<div>
						<span class="font-semibold">columnWidth:</span>
						<span class="ml-2">{settingsStore.settings.columnWidth}px</span>
					</div>
					<div>
						<span class="font-semibold">relaysPublic:</span>
						<span class="ml-2">{settingsStore.settings.relaysPublic.length} relays</span>
					</div>
					<div>
						<span class="font-semibold">isLlmConfigured:</span>
						<span class="ml-2">{settingsStore.isLlmConfigured}</span>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>
</div>

<style>
	:global(body) {
		background: #f9fafb;
	}
</style>
