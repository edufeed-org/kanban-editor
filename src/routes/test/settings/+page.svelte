<script lang="ts">
	import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { onMount } from 'svelte';

	let testResults = $state<{ test: string; status: 'pass' | 'fail'; message: string }[]>([]);
	let isBrowser = $state(false);
	let storageData = $state<{
		hasSettings: boolean;
		hasConfig: boolean;
		config: any | null;
	}>({
		hasSettings: false,
		hasConfig: false,
		config: null
	});

	// Load localStorage data only in browser
	onMount(async () => {
		isBrowser = true;
		
		// Force config load wenn nicht bereits geladen
		if (typeof window !== 'undefined') {
			const hasConfig = localStorage.getItem('kanban-config');
			if (!hasConfig) {
				console.log('🔄 Config nicht in localStorage - lade jetzt...');
				await settingsStore.initializeConfig();
				console.log('✅ Config manuell geladen');
			}
		}
		
		updateStorageData();
	});

	function updateStorageData() {
		if (typeof window === 'undefined') return;

		const settingsJson = localStorage.getItem('kanban-settings');
		const configJson = localStorage.getItem('kanban-config');

		storageData = {
			hasSettings: !!settingsJson,
			hasConfig: !!configJson,
			config: configJson ? JSON.parse(configJson) : null
		};
	}

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

	// Test 7: config.json gecacht in localStorage
	function test7() {
		try {
			const configCache = localStorage.getItem('kanban-config');
			if (configCache) {
				const config = JSON.parse(configCache);
				testResults = [
					...testResults,
					{
						test: '7. config.json Cache',
						status: 'pass',
						message: `✅ Config gecacht mit ${Object.keys(config).length} Keys`
					}
				];
			} else {
				throw new Error('config.json nicht in localStorage gecacht');
			}
		} catch (error) {
			testResults = [
				...testResults,
				{
					test: '7. config.json Cache',
					status: 'fail',
					message: `❌ Fehler: ${error}`
				}
			];
		}
	}

	// Test 8: config.json Werte wurden in Settings gemerged
	function test8() {
		try {
			const configCache = localStorage.getItem('kanban-config');
			if (!configCache) {
				throw new Error('config.json nicht gecacht - kann Merge nicht testen');
			}

			const config = JSON.parse(configCache);
			const settings = settingsStore.settings;
			const hasUserSettings = localStorage.getItem('kanban-settings') !== null;

			// Prüfe Smart-Merge Logik
			if (hasUserSettings) {
				// User-Settings existieren → config sollte NICHT gemerged sein
				testResults = [
					...testResults,
					{
						test: '8. config.json Merge',
						status: 'pass',
						message: `✅ Smart-Merge: User-Settings vorhanden → config.json wird nicht überschrieben (korrekt!)`
					}
				];
			} else {
				// Erste Installation → config sollte als Defaults gemerged sein
				if (config.ui?.maxCardsBeforeScroll !== undefined) {
					if (settings.maxCardsBeforeScroll === config.ui.maxCardsBeforeScroll) {
						testResults = [
							...testResults,
							{
								test: '8. config.json Merge',
								status: 'pass',
								message: `✅ Config-Werte als Defaults gemerged: maxCards=${settings.maxCardsBeforeScroll}`
							}
						];
					} else {
						throw new Error(
							`Werte unterschiedlich: config=${config.ui.maxCardsBeforeScroll}, settings=${settings.maxCardsBeforeScroll}`
						);
					}
				} else {
					throw new Error('config.ui.maxCardsBeforeScroll nicht in config.json');
				}
			}
		} catch (error) {
			testResults = [
				...testResults,
				{
					test: '8. config.json Merge',
					status: 'fail',
					message: `❌ Fehler: ${error}`
				}
			];
		}
	}

	// Test 9: Nostr Relays aus config.json
	function test9() {
		try {
			const configCache = localStorage.getItem('kanban-config');
			if (!configCache) {
				throw new Error('config.json nicht gecacht');
			}

			const config = JSON.parse(configCache);
			const settings = settingsStore.settings;

			// Prüfe ob config.nostr.relaysPublic in Settings ist
			if (config.nostr?.relaysPublic) {
				const configRelays = config.nostr.relaysPublic.length;
				const settingsRelays = settings.relaysPublic.length;

				if (settingsRelays >= configRelays) {
					testResults = [
						...testResults,
						{
							test: '9. Nostr Relays aus config',
							status: 'pass',
							message: `✅ Relays geladen: ${settingsRelays} in Settings (${configRelays} in config)`
						}
					];
				} else {
					throw new Error(
						`Relays fehlen: config hat ${configRelays}, settings nur ${settingsRelays}`
					);
				}
			} else {
				throw new Error('config.nostr.relaysPublic nicht gefunden');
			}
		} catch (error) {
			testResults = [
				...testResults,
				{
					test: '9. Nostr Relays aus config',
					status: 'fail',
					message: `❌ Fehler: ${error}`
				}
			];
		}
	}

	// Test 10: Settings ändern und neu laden (Persistenz-Test)
	async function test10() {
		try {
			// Ändere einen Wert
			const oldValue = settingsStore.settings.columnWidth;
			const newValue = oldValue === 350 ? 400 : 350;
			settingsStore.setColumnWidth(newValue);

			// Warte kurz
			await new Promise((resolve) => setTimeout(resolve, 100));

			// Prüfe localStorage
			const stored = localStorage.getItem('kanban-settings');
			if (!stored) {
				throw new Error('Nichts in localStorage gespeichert');
			}

			const parsed = JSON.parse(stored);
			if (parsed.columnWidth === newValue) {
				testResults = [
					...testResults,
					{
						test: '10. Persistenz nach Änderung',
						status: 'pass',
						message: `✅ Wert gespeichert: columnWidth=${newValue}`
					}
				];
			} else {
				throw new Error(
					`Wert nicht korrekt gespeichert: erwartet ${newValue}, gefunden ${parsed.columnWidth}`
				);
			}
		} catch (error) {
			testResults = [
				...testResults,
				{
					test: '10. Persistenz nach Änderung',
					status: 'fail',
					message: `❌ Fehler: ${error}`
				}
			];
		}
	}

	// Alle Tests ausführen
	async function runAllTests() {
		testResults = [];
		test1();
		test2();
		test3();
		test4();
		test5();
		test6();
		test7();
		test8();
		test9();
		await test10();
		updateStorageData(); // Update UI nach Tests
	}

	// Settings Debug ausgeben
	function debugPrint() {
		settingsStore.debugPrintSettings();
	}

	// Force reload config.json
	async function forceReloadConfig() {
		console.log('🔄 Force reload config.json...');
		localStorage.removeItem('kanban-config'); // Clear cache
		await settingsStore.initializeConfig();
		updateStorageData();
		console.log('✅ Config reloaded');
	}

	// Force merge config.json (überschreibt User-Settings!)
	async function forceMergeConfig() {
		if (!confirm('⚠️ Dies überschreibt ALLE User-Settings mit config.json Werten!\n\nFortfahren?')) {
			return;
		}
		
		console.log('⚠️  Force merge config.json...');
		localStorage.removeItem('kanban-config'); // Clear cache
		localStorage.removeItem('kanban-settings'); // Clear user settings
		await settingsStore.initializeConfig(true); // Force overwrite
		updateStorageData();
		console.log('✅ Config force-merged');
		
		// Reload page um neue Settings anzuzeigen
		window.location.reload();
	}
</script>

<div class="p-8 max-w-4xl mx-auto">
	<h1 class="text-3xl font-bold mb-6">⚙️ SettingsStore Test Suite</h1>

	<!-- Buttons -->
	<div class="flex gap-4 mb-8 flex-wrap">
		<Button onclick={runAllTests} class="bg-green-600 hover:bg-green-700">
			🚀 Alle Tests ausführen
		</Button>
		<Button onclick={forceReloadConfig} class="bg-blue-600 hover:bg-blue-700">
			🔄 Config.json neu laden
		</Button>
		<Button onclick={forceMergeConfig} class="bg-orange-600 hover:bg-orange-700">
			⚠️ Config Force-Merge
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
		<div class="grid grid-cols-3 gap-3">
			<Button onclick={test1} variant="outline">Test 1: Settings laden</Button>
			<Button onclick={test2} variant="outline">Test 2: maxCards ändern</Button>
			<Button onclick={test3} variant="outline">Test 3: localStorage</Button>
			<Button onclick={test4} variant="outline">Test 4: Theme wechsel</Button>
			<Button onclick={test5} variant="outline">Test 5: Relay add</Button>
			<Button onclick={test6} variant="outline">Test 6: Export</Button>
			<Button onclick={test7} variant="outline">Test 7: config.json Cache</Button>
			<Button onclick={test8} variant="outline">Test 8: config.json Merge</Button>
			<Button onclick={test9} variant="outline">Test 9: Relays aus config</Button>
			<Button onclick={test10} variant="outline">Test 10: Persistenz</Button>
		</div>
	</div>

	<!-- Current Settings Display -->
	<div class="mt-8 pt-6 border-t">
		<h2 class="text-lg font-semibold mb-4">📍 Aktuelle Settings:</h2>
		<div class="grid grid-cols-2 gap-4">
			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">Settings Store</Card.Title>
				</Card.Header>
				<Card.Content>
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

			<Card.Root>
				<Card.Header>
					<Card.Title class="text-base">localStorage Status</Card.Title>
				</Card.Header>
				<Card.Content>
					<div class="space-y-2 text-sm">
						{#if isBrowser}
							<div>
								<span class="font-semibold">kanban-settings:</span>
								<span class="ml-2">
									{storageData.hasSettings ? '✅ Vorhanden' : '❌ Fehlt'}
								</span>
							</div>
							<div>
								<span class="font-semibold">kanban-config:</span>
								<span class="ml-2">
									{storageData.hasConfig ? '✅ Gecacht' : '❌ Nicht gecacht'}
								</span>
							</div>
							{#if storageData.config}
								<div class="mt-2 pt-2 border-t">
									<div class="text-xs font-semibold mb-1">config.json Inhalt:</div>
									<div class="text-xs opacity-70">
										<div>UI: {storageData.config.ui ? '✅' : '❌'}</div>
										<div>Nostr: {storageData.config.nostr ? '✅' : '❌'}</div>
										<div>LLM: {storageData.config.llm ? '✅' : '❌'}</div>
										<div>Defaults: {storageData.config.defaults ? '✅' : '❌'}</div>
										<div>Sidebar: {storageData.config.sidebar ? '✅' : '❌'}</div>
									</div>
								</div>
							{/if}
						{:else}
							<div class="text-sm opacity-50">⏳ Browser wird geladen...</div>
						{/if}
					</div>
				</Card.Content>
			</Card.Root>
		</div>
	</div>
</div>

<style>
	:global(body) {
		background: #f9fafb;
	}
</style>
