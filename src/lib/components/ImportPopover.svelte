<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import { boardStore } from '$lib/stores/kanbanStore.svelte.js';

	let open = $state(false);
	let importMode = $state<'merge' | 'new' | 'overwrite'>('merge');
	let selectedFile = $state<File | null>(null);
	let isLoading = $state(false);
	let errorMsg = $state('');
	let successMsg = $state('');

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		selectedFile = input.files?.[0] || null;
		errorMsg = '';
		successMsg = '';
	}

	async function confirmImport() {
		if (!selectedFile) {
			errorMsg = 'Bitte wählen Sie eine JSON-Datei';
			return;
		}

		isLoading = true;
		errorMsg = '';
		successMsg = '';

		try {
			// Lese Datei
			const jsonString = await selectedFile.text();

			// Importiere mit ausgewähltem Mode
			const result = boardStore.importBoardFromJson(jsonString, importMode);

			if (result.success && result.board) {
				// Speichere das importierte Board
				try {
					// Bei 'overwrite' mode: Ersetze aktuelles Board
					const overwrite = importMode === 'overwrite';
					const boardId = boardStore.saveImportedBoard(result.board, overwrite);

					successMsg = overwrite
						? `✅ Board aktualisiert! ${result.board.name}`
						: `✅ Board importiert! ${result.board.name}`;

					console.log('Board ID:', boardId);

					// Reset
					selectedFile = null;
					importMode = 'merge';
					
					// Schließe Popover nach kurzer Verzögerung
					setTimeout(() => {
						open = false;
					}, 1500);
				} catch (saveError) {
					errorMsg = `Fehler beim Speichern: ${saveError instanceof Error ? saveError.message : String(saveError)}`;
				}
			} else {
				errorMsg = result.error || 'Import fehlgeschlagen';
			}
		} catch (error) {
			errorMsg = `Fehler beim Lesen der Datei: ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			isLoading = false;
		}
	}

	function resetForm() {
		selectedFile = null;
		importMode = 'merge';
		errorMsg = '';
		successMsg = '';
	}

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;
		if (!newOpen) {
			resetForm();
		}
	}
</script>

<Popover.Root bind:open onOpenChange={handleOpenChange}>
	<Popover.Trigger>
		<UploadIcon class="h-4 w-4" />
		Import
	</Popover.Trigger>

	<Popover.Content class="w-80 p-4" side="bottom">
		<div class="space-y-4">
			<!-- Header -->
			<h4 class="font-semibold leading-none">📥 Board importieren</h4>

			<!-- File Input -->
			<div>
				<label for="file-input" class="text-sm font-medium">JSON Datei</label>
				<input
					id="file-input"
					type="file"
					accept=".json"
					onchange={handleFileSelect}
					disabled={isLoading}
					class="mt-2 block w-full text-sm text-slate-500 file:mr-4 file:rounded file:border file:border-slate-200 file:bg-slate-100 file:px-2 file:py-1 file:text-sm file:font-medium hover:file:bg-slate-200"
				/>
				{#if selectedFile}
					<p class="mt-1 text-xs text-green-600">✓ {selectedFile.name}</p>
				{/if}
			</div>

			<!-- Mode Selection -->
			<fieldset class="space-y-2">
				<legend class="text-sm font-medium">Import-Modus</legend>
				<div class="space-y-1.5">
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							value="merge"
							bind:group={importMode}
							disabled={isLoading}
							class="cursor-pointer"
						/>
						<span class="text-sm">
							<strong>Merge</strong>
							<span class="block text-xs text-slate-500">Neue IDs (keine Konflikte)</span>
						</span>
					</label>

					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							value="new"
							bind:group={importMode}
							disabled={isLoading}
							class="cursor-pointer"
						/>
						<span class="text-sm">
							<strong>Neues Board</strong>
							<span class="block text-xs text-slate-500">Separate Kopie mit (Imported) Suffix</span>
						</span>
					</label>

					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="radio"
							value="overwrite"
							bind:group={importMode}
							disabled={isLoading}
							class="cursor-pointer"
						/>
						<span class="text-sm">
							<strong>Ersetzen</strong>
							<span class="block text-xs text-red-600">⚠️ Aktuelles Board wird überschrieben!</span>
						</span>
					</label>
				</div>
			</fieldset>

			<!-- Error Message -->
			{#if errorMsg}
				<div class="rounded bg-red-50 p-2 text-sm text-red-700 border border-red-200">
					{errorMsg}
				</div>
			{/if}

			<!-- Success Message -->
			{#if successMsg}
				<div class="rounded bg-green-50 p-2 text-sm text-green-700 border border-green-200">
					{successMsg}
				</div>
			{/if}

			<!-- Buttons -->
			<div class="flex gap-2">
				<button
					type="button"
					onclick={confirmImport}
					disabled={!selectedFile || isLoading}
					class="flex-1 inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md {selectedFile ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-slate-200 text-slate-600'} disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{#if isLoading}
						<span class="mr-2">⏳</span>
						Importieren...
					{:else}
						<UploadIcon class="h-4 w-4 mr-2" />
						Importieren
					{/if}
				</button>

				<button
					type="button"
					onclick={() => {
						open = false;
					}}
					disabled={isLoading}
					class="inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md border border-slate-200 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Abbrechen
				</button>
			</div>

			<!-- Help Text -->
			<p class="text-xs text-slate-500 border-t pt-2">
				💡 <strong>Tipp:</strong> Exportiere Boards mit dem Download-Button im Board-Dialog und importiere sie hier wieder.
			</p>
		</div>
	</Popover.Content>
</Popover.Root>
