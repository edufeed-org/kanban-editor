<script lang="ts">
    /**
     * AuthStore Integration Test - Test Suite Component
     * 
     * 🎯 Verifies dass card.author automatisch vom aktuellen User gesetzt wird
     * 
     * Verwendung:
     * http://localhost:5173/test/authstore
     */
    
	import { authStore } from '$lib/stores/authStore.svelte.js';
	import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import PlusIcon from "@lucide/svelte/icons/plus";
	import RotateCwIcon from "@lucide/svelte/icons/rotate-cw";
	import CheckCircle2Icon from "@lucide/svelte/icons/check-circle-2";
	import XCircleIcon from "@lucide/svelte/icons/x-circle";

	interface TestResult {
		name: string;
		passed: boolean;
		error?: string;
		duration: number;
	}

	let results = $state<TestResult[]>([]);
	let isRunning = $state(false);
	let totalTime = $state(0);

	async function runAuthStoreTests() {
		isRunning = true;
		results = [];
		totalTime = 0;

		const tests = [
			{
				name: 'AuthStore Initialization',
				fn: () => {
					if (!authStore.isAuthenticated) return true;
					throw new Error('Should not be authenticated initially');
				}
			},
			{
				name: 'Dummy Login',
				fn: async () => {
					const success = await authStore.loginWithDummy('Test User');
					if (!success) throw new Error('Login failed');
					if (!authStore.isAuthenticated) throw new Error('Not authenticated after login');
					if (authStore.currentUser?.profile?.name !== 'Test User') throw new Error('Name mismatch');
					return true;
				}
			},
			{
				name: 'Get Pubkey',
				fn: () => {
					const pubkey = authStore.getPubkey();
					if (!pubkey) throw new Error('Pubkey is null');
					if (!pubkey.startsWith('0000')) throw new Error('Invalid pubkey format');
					return true;
				}
			},
			{
				name: 'Get Npub',
				fn: () => {
					const npub = authStore.getNpub();
					if (!npub) throw new Error('Npub is null');
					if (!npub.startsWith('npub')) throw new Error('Invalid npub format');
					return true;
				}
			},
			{
				name: 'localStorage Persistence',
				fn: () => {
					const stored = localStorage.getItem('kanban-auth-session');
					if (!stored) throw new Error('Session not saved to localStorage');
					const session = JSON.parse(stored);
					if (session.name !== 'Test User') throw new Error('Session data mismatch');
					return true;
				}
			},
			{
				name: 'Create Card with Author',
				fn: () => {
					const columnId = boardStore.data.columns[0]?.id;
					if (!columnId) throw new Error('No column found');

					const cardId = boardStore.createCard(columnId, 'AuthStore Test Card');
					const card = boardStore.data.columns
						.find((c) => c.id === columnId)
						?.cards.find((c) => c.id === cardId);

					if (!card) throw new Error('Card not found after creation');
					if (!card.author) throw new Error('Card has no author');
					if (card.author !== authStore.getPubkey()) throw new Error('Author does not match current user');
					return true;
				}
			},
			{
				name: 'Logout',
				fn: () => {
					authStore.logout();
					if (authStore.isAuthenticated) throw new Error('Still authenticated after logout');
					if (authStore.currentUser !== null) throw new Error('currentUser not cleared');
					return true;
				}
			},
			{
				name: 'Session Cleared from Storage',
				fn: () => {
					const stored = localStorage.getItem('kanban-auth-session');
					if (stored !== null) throw new Error('Session not cleared from localStorage');
					return true;
				}
			}
		];

		let passed = 0;
		let failed = 0;

		for (const test of tests) {
			const startTime = performance.now();

			try {
				const result = test.fn();
				if (result instanceof Promise) {
					await result;
				}

				results.push({
					name: test.name,
					passed: true,
					duration: performance.now() - startTime
				});
				passed++;
			} catch (error) {
				results.push({
					name: test.name,
					passed: false,
					error: error instanceof Error ? error.message : String(error),
					duration: performance.now() - startTime
				});
				failed++;
			}

			// Small delay between tests
			await new Promise((resolve) => setTimeout(resolve, 100));
		}

		totalTime = results.reduce((sum, r) => sum + r.duration, 0);

		isRunning = false;
		console.log(`✅ AuthStore Tests Complete: ${passed} passed, ${failed} failed (${totalTime.toFixed(2)}ms)`);
	}

	function clearResults() {
		results = [];
		totalTime = 0;
	}

	$effect(() => {
		if (!isRunning && results.length > 0) {
			// Scroll to results
			setTimeout(() => {
				const elem = document.querySelector('[data-results]');
				elem?.scrollIntoView({ behavior: 'smooth' });
			}, 100);
		}
	});
</script>

<div class="min-h-screen p-6" style="background: linear-gradient(to bottom right, rgb(249, 250, 251), rgb(243, 244, 246));">
	<div class="container mx-auto max-w-4xl">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="text-4xl font-bold mb-2">🧪 AuthStore Integration Tests</h1>
			<p class="text-gray-600">
				Verifiziert dass card.author automatisch vom aktuellen User gesetzt wird
			</p>
		</div>

		<!-- Test Info Card -->
		<Card.Root class="mb-6 bg-blue-50 border-blue-200">
			<Card.Header>
				<Card.Title>Was wird getestet?</Card.Title>
			</Card.Header>
			<Card.Content class="text-sm space-y-2">
				<p>✅ AuthStore Initialization</p>
				<p>✅ Dummy Login Funktionalität</p>
				<p>✅ Public Key Abfrage (getPubkey)</p>
				<p>✅ Session Persistierung (localStorage)</p>
				<p>✅ Automatisches Setzen von card.author</p>
				<p>✅ Logout & Cleanup</p>
			</Card.Content>
		</Card.Root>

		<!-- Control Buttons -->
		<div class="flex gap-3 mb-6">
			<Button
				onclick={runAuthStoreTests}
				disabled={isRunning}
				class="px-6 py-2 rounded-lg font-semibold bg-green-600 hover:bg-green-700 text-white"
			>
				{#if isRunning}
					<span class="inline-block animate-spin mr-2">⏳</span>
					Tests laufen...
				{:else}
					<PlusIcon class="w-4 h-4 mr-2 inline" />
					Tests ausführen
				{/if}
			</Button>

			<Button
				onclick={clearResults}
				variant="outline"
				disabled={isRunning}
				class="px-6 py-2 rounded-lg font-semibold"
			>
				<RotateCwIcon class="w-4 h-4 mr-2 inline" />
				Zurücksetzen
			</Button>
		</div>

		<!-- Results -->
		{#if results.length > 0}
			<div data-results class="space-y-3">
				{#each results as result (result.name)}
					<Card.Root class="border-l-4 {result.passed ? 'border-l-green-500 bg-green-50' : 'border-l-red-500 bg-red-50'}">
						<Card.Content class="pt-4">
							<div class="flex items-start justify-between">
								<div class="flex items-start gap-3 flex-1">
									{#if result.passed}
										<CheckCircle2Icon class="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
									{:else}
										<XCircleIcon class="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
									{/if}
									<div class="flex-1">
										<h3 class="font-semibold {result.passed ? 'text-green-900' : 'text-red-900'}">
											{result.name}
										</h3>
										{#if result.error}
											<p class="text-sm text-red-700 mt-1 font-mono">{result.error}</p>
										{/if}
									</div>
								</div>
								<div class="text-xs text-gray-600 ml-4 flex-shrink-0">
									{result.duration.toFixed(2)}ms
								</div>
							</div>
						</Card.Content>
					</Card.Root>
				{/each}

				<!-- Summary -->
				<Card.Root class="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
					<Card.Content class="pt-4">
						<div class="text-center">
							<h3 class="text-lg font-bold text-blue-900 mb-2">Test Summary</h3>
							<div class="grid grid-cols-3 gap-4 mb-4">
								<div>
									<div class="text-2xl font-bold text-blue-600">{results.length}</div>
									<div class="text-sm text-gray-600">Tests</div>
								</div>
								<div>
									<div class="text-2xl font-bold text-green-600">{results.filter((r) => r.passed).length}</div>
									<div class="text-sm text-gray-600">Bestanden</div>
								</div>
								<div>
									<div class="text-2xl font-bold text-red-600">{results.filter((r) => !r.passed).length}</div>
									<div class="text-sm text-gray-600">Fehlgeschlagen</div>
								</div>
							</div>
							<p class="text-sm text-gray-700">
								Gesamtdauer: <span class="font-mono font-bold">{totalTime.toFixed(2)}ms</span>
							</p>

							{#if results.every((r) => r.passed)}
								<p class="mt-4 text-lg font-bold text-green-600">🎉 Alle Tests bestanden!</p>
							{/if}
						</div>
					</Card.Content>
				</Card.Root>
			</div>
		{:else if !isRunning}
			<Card.Root class="bg-blue-50 border-blue-200 text-center p-6">
				<p class="text-blue-900">
					Klicke auf "Tests ausführen" um die AuthStore Tests zu starten.
				</p>
			</Card.Root>
		{/if}
	</div>
</div>

<style>
	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
			Arial, sans-serif;
	}
</style>
