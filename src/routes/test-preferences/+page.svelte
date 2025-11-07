<script lang="ts">
	import { userPreferencesStore } from '$lib/stores/userPreferencesStore.svelte';
	import { Button } from '$lib/components/ui/button';
	import * as Card from '$lib/components/ui/card';

	// Reactive state from store
	let preferences = $derived(userPreferencesStore.preferences);
	let categorized = $derived(userPreferencesStore.categorizedPreferences);

	// Test Functions
	function runTest1() {
		console.group('🧪 Test 1: Learn new preference');
		const result = userPreferencesStore.learnPreference(
			'structure',
			'DEFAULT_COLUMNS',
			['Backlog', 'In Progress', 'Done'],
			'board-123',
			'Test Board 1'
		);
		console.log('Result:', result);
		console.log('isNew:', result.isNew); // Should be true
		console.log('confidence:', result.preference.confidence); // Should be 0.5
		console.groupEnd();
	}

	function runTest2() {
		console.group('🧪 Test 2: Repeat preference (should increase confidence)');
		const result = userPreferencesStore.learnPreference(
			'structure',
			'DEFAULT_COLUMNS',
			['Backlog', 'In Progress', 'Done'],
			'board-456',
			'Test Board 2'
		);
		console.log('Result:', result);
		console.log('isNew:', result.isNew); // Should be false
		console.log('confidence:', result.preference.confidence); // Should be 0.6
		console.log('previousConfidence:', result.previousConfidence); // Should be 0.5
		console.groupEnd();
	}

	function runTest3() {
		console.group('🧪 Test 3: Get all structure preferences');
		const structurePrefs = userPreferencesStore.getPreferences('structure');
		console.log('Structure preferences:', structurePrefs);
		console.log('Count:', structurePrefs.length);
		console.groupEnd();
	}

	function runTest4() {
		console.group('🧪 Test 4: Get AI Context (minConfidence: 0.7)');
		const context = userPreferencesStore.getAIContext(0.7);
		console.log('AI Context:', context);
		console.log('Meta:', context.meta);
		console.groupEnd();
	}

	function runTest5() {
		console.group('🧪 Test 5: Check localStorage');
		const stored = localStorage.getItem('user-preferences');
		if (stored) {
			const parsed = JSON.parse(stored);
			console.log('localStorage data:', parsed);
			console.log('Preferences count:', parsed.preferences.length);
		} else {
			console.log('No data in localStorage');
		}
		console.groupEnd();
	}

	function runTest6() {
		console.group('🧪 Test 6: Adapt preference (change value)');
		const result = userPreferencesStore.adaptPreference(
			'DEFAULT_COLUMNS',
			['Todo', 'Doing', 'Done'], // Changed value
			'board-789',
			'Test Board 3'
		);
		if (result) {
			console.log('Adapt result:', result);
			console.log('Confidence delta:', result.confidenceDelta); // Should be negative
			console.log('Was auto-applied:', result.wasAutoApplied);
		} else {
			console.log('Preference not found');
		}
		console.groupEnd();
	}

	function runTest7() {
		console.group('🧪 Test 7: Export preferences');
		const exported = userPreferencesStore.exportPreferences();
		console.log('Exported JSON:', exported);
		console.groupEnd();
	}

	function clearAll() {
		console.group('🗑️  Clear all preferences');
		userPreferencesStore.clear();
		console.log('All preferences cleared');
		console.groupEnd();
	}
</script>

<div class="container mx-auto p-8">
	<h1 class="text-3xl font-bold mb-6">UserPreferencesStore Test Suite</h1>

	<div class="grid grid-cols-2 gap-6 mb-8">
		<!-- Test Buttons -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Test Functions</Card.Title>
				<Card.Description>Run manual tests (check console for output)</Card.Description>
			</Card.Header>
			<Card.Content class="flex flex-col gap-2">
				<Button onclick={runTest1}>Test 1: Learn New Preference</Button>
				<Button onclick={runTest2}>Test 2: Repeat Preference (+0.1)</Button>
				<Button onclick={runTest3}>Test 3: Get Structure Prefs</Button>
				<Button onclick={runTest4}>Test 4: Get AI Context</Button>
				<Button onclick={runTest5}>Test 5: Check localStorage</Button>
				<Button onclick={runTest6}>Test 6: Adapt Preference (-0.2)</Button>
				<Button onclick={runTest7}>Test 7: Export JSON</Button>
				<Button variant="destructive" onclick={clearAll}>Clear All</Button>
			</Card.Content>
		</Card.Root>

		<!-- Current State -->
		<Card.Root>
			<Card.Header>
				<Card.Title>Current State</Card.Title>
				<Card.Description>Live reactive data from store</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="space-y-4">
					<div>
						<p class="font-semibold">Total Preferences:</p>
						<p class="text-2xl">{preferences.length}</p>
					</div>
					<div>
						<p class="font-semibold">By Category:</p>
						<ul class="text-sm space-y-1">
							<li>Structure: {categorized.structure.length}</li>
							<li>Workflow: {categorized.workflow.length}</li>
							<li>Pedagogy: {categorized.pedagogy.length}</li>
							<li>Constraints: {categorized.constraints.length}</li>
							<li>Content: {categorized.content.length}</li>
						</ul>
					</div>
				</div>
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Preferences List -->
	<Card.Root>
		<Card.Header>
			<Card.Title>All Preferences</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if preferences.length === 0}
				<p class="text-muted-foreground">No preferences yet. Run Test 1 to create one.</p>
			{:else}
				<div class="space-y-2">
					{#each preferences as pref}
						<div class="border rounded p-3">
							<div class="flex justify-between items-start">
								<div>
									<p class="font-semibold">{pref.key}</p>
									<p class="text-sm text-muted-foreground">Category: {pref.category}</p>
								</div>
								<div class="text-right">
									<p class="font-mono text-sm">
										Confidence: {Math.round(pref.confidence * 100)}%
									</p>
									<p class="text-xs text-muted-foreground">
										{pref.confidence >= 0.8 ? '✅ Auto-apply' : '⏳ Learning'}
									</p>
								</div>
							</div>
							<div class="mt-2">
								<p class="text-sm">Value: <code>{JSON.stringify(pref.value)}</code></p>
								<p class="text-xs text-muted-foreground">
									Learned from {pref.learnedFrom.length} board(s)
								</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
