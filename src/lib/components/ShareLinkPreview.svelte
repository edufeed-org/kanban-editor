<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import AlertCircleIcon from '@lucide/svelte/icons/alert-circle';
	import CheckCircleIcon from '@lucide/svelte/icons/check-circle';
	import EyeIcon from '@lucide/svelte/icons/eye';
	import type { Board } from '$lib/classes/BoardModel.js';

	type ImportMode = 'merge' | 'new' | 'overwrite' | 'watch';

	interface Props {
		open?: boolean;
		boardData: Partial<Board> | null;
		tokenSize: number;
		maxTokenSize: number;
		isLoading?: boolean;
		onConfirm: (mode: ImportMode) => void;
		onCancel: () => void;
	}

	let { open = false, boardData, tokenSize, maxTokenSize, isLoading = false, onConfirm, onCancel }: Props = $props();

	let selectedMode = $state<ImportMode>('merge');

	// Berechne Token-Größe Prozentsatz
	let tokenSizePercent = $derived(Math.round((tokenSize / maxTokenSize) * 100));
	let isSizeWarning = $derived(tokenSizePercent > 80);
	let isSizeError = $derived(tokenSizePercent > 100);

	// Board-Statistiken
	let stats = $derived.by(() => {
		if (!boardData) return { columns: 0, cards: 0, comments: 0 };

		let cardCount = 0;
		let commentCount = 0;

		if (Array.isArray(boardData.columns)) {
			boardData.columns.forEach((col: any) => {
				if (Array.isArray(col.cards)) {
					cardCount += col.cards.length;
					col.cards.forEach((card: any) => {
						if (Array.isArray(card.comments)) {
							commentCount += card.comments.length;
						}
					});
				}
			});
		}

		return {
			columns: boardData.columns?.length || 0,
			cards: cardCount,
			comments: commentCount
		};
	});

	function handleConfirm() {
		onConfirm(selectedMode);
		selectedMode = 'merge'; // Reset for next time
	}

	function handleCancel() {
		onCancel();
	}
</script>

<Dialog.Root {open} onOpenChange={(newOpen) => {
	if (!newOpen) {
		handleCancel();
	}
}}>
	<Dialog.Content class="max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<UploadIcon class="h-5 w-5" />
				Share-Link Preview
			</Dialog.Title>
			<Dialog.Description>
				Überprüfe die Details vor dem Import
			</Dialog.Description>
		</Dialog.Header>

		<div class="space-y-4">
			<!-- Board Info Card -->
			{#if boardData}
				<Card.Root class="bg-muted/50">
					<Card.Content class="pt-4">
						<div class="space-y-2">
							<div>
								<h3 class="font-semibold text-sm">{boardData.name || 'Unbenanntes Board'}</h3>
								{#if boardData.description}
									<p class="text-xs text-muted-foreground">{boardData.description}</p>
								{/if}
							</div>

							<!-- Statistics -->
							<div class="grid grid-cols-3 gap-2 pt-2 border-t">
								<div class="text-center">
									<p class="text-lg font-bold">{stats.columns}</p>
									<p class="text-xs text-muted-foreground">Spalten</p>
								</div>
								<div class="text-center">
									<p class="text-lg font-bold">{stats.cards}</p>
									<p class="text-xs text-muted-foreground">Karten</p>
								</div>
								<div class="text-center">
									<p class="text-lg font-bold">{stats.comments}</p>
									<p class="text-xs text-muted-foreground">Kommentare</p>
								</div>
							</div>
						</div>
					</Card.Content>
				</Card.Root>
			{/if}

			<!-- Token Size Info -->
			<div class="space-y-1">
				<div class="flex justify-between items-center text-xs">
					<span class="font-medium">Größe des Share-Link</span>
					<span class="text-muted-foreground">
						{(tokenSize / 1024).toFixed(1)} KB / {(maxTokenSize / 1024).toFixed(0)} KB
					</span>
				</div>
				<div class="w-full bg-muted rounded-full h-2 overflow-hidden">
					<div
						class="h-full transition-all"
						class:bg-green-500={!isSizeWarning}
						class:bg-yellow-500={isSizeWarning && !isSizeError}
						class:bg-red-500={isSizeError}
						style="width: {Math.min(tokenSizePercent, 100)}%"
					>
                    </div>
				</div>
				{#if isSizeWarning && !isSizeError}
					<div class="flex items-start gap-2 text-xs text-yellow-700 bg-yellow-50 p-2 rounded">
						<AlertCircleIcon class="h-4 w-4 mt-0.5 flex-shrink-0" />
						<span>Share-Link ist groß. Für sehr große Boards besser Export verwenden.</span>
					</div>
				{/if}
				{#if isSizeError}
					<div class="flex items-start gap-2 text-xs text-red-700 bg-red-50 p-2 rounded">
						<AlertCircleIcon class="h-4 w-4 mt-0.5 flex-shrink-0" />
						<span>Share-Link überschreitet Größenlimit. Verwende stattdessen Export.</span>
					</div>
				{/if}
			</div>

			<!-- Import Mode Selection -->
			<fieldset class="space-y-2 border-t pt-4">
				<legend class="text-sm font-medium">Import-Modus</legend>
				<div class="space-y-2">
					<!-- Nur Beobachten - First option for read-only following -->
					<label class="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer border border-blue-200 bg-blue-50/50">
						<input
							type="radio"
							value="watch"
							bind:group={selectedMode}
							disabled={isLoading}
							class="mt-1 cursor-pointer"
						/>
						<div class="flex-1">
							<p class="text-sm font-medium flex items-center gap-2">
								<EyeIcon class="h-4 w-4 text-blue-600" />
								Nur Beobachten
							</p>
							<p class="text-xs text-muted-foreground">Board folgen (read-only, keine Kopie)</p>
						</div>
						{#if selectedMode === 'watch'}
							<CheckCircleIcon class="h-4 w-4 text-blue-600 mt-1" />
						{/if}
					</label>

					<div class="relative py-2">
						<div class="absolute inset-0 flex items-center">
							<span class="w-full border-t border-dashed"></span>
						</div>
						<div class="relative flex justify-center text-xs uppercase">
							<span class="bg-background px-2 text-muted-foreground">oder eigene Kopie erstellen</span>
						</div>
					</div>

					<label class="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
						<input
							type="radio"
							value="merge"
							bind:group={selectedMode}
							disabled={isLoading}
							class="mt-1 cursor-pointer"
						/>
						<div class="flex-1">
							<p class="text-sm font-medium">Merge</p>
							<p class="text-xs text-muted-foreground">Eigene Kopie mit neuen IDs</p>
						</div>
						{#if selectedMode === 'merge'}
							<CheckCircleIcon class="h-4 w-4 text-green-600 mt-1" />
						{/if}
					</label>

					<label class="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
						<input
							type="radio"
							value="new"
							bind:group={selectedMode}
							disabled={isLoading}
							class="mt-1 cursor-pointer"
						/>
						<div class="flex-1">
							<p class="text-sm font-medium">Neues Board</p>
							<p class="text-xs text-muted-foreground">Eigene Kopie mit (Imported) Suffix</p>
						</div>
						{#if selectedMode === 'new'}
							<CheckCircleIcon class="h-4 w-4 text-green-600 mt-1" />
						{/if}
					</label>

					<label class="flex items-start gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
						<input
							type="radio"
							value="overwrite"
							bind:group={selectedMode}
							disabled={isLoading}
							class="mt-1 cursor-pointer"
						/>
						<div class="flex-1">
							<p class="text-sm font-medium">Ersetzen</p>
							<p class="text-xs text-red-600 font-medium">⚠️ Aktuelles Board wird überschrieben!</p>
						</div>
						{#if selectedMode === 'overwrite'}
							<CheckCircleIcon class="h-4 w-4 text-red-600 mt-1" />
						{/if}
					</label>
				</div>
			</fieldset>
		</div>

		<Dialog.Footer class="gap-2">
			<Button
				type="button"
				variant="outline"
				onclick={onCancel}
				disabled={isLoading}
			>
				Abbrechen
			</Button>
			<Button
				type="button"
				onclick={handleConfirm}
				disabled={isLoading || isSizeError}
				class="gap-2"
			>
				{#if isLoading}
					<span class="mr-1">⏳</span>
					{selectedMode === 'watch' ? 'Folge...' : 'Importiert...'}
				{:else if selectedMode === 'watch'}
					<EyeIcon class="h-4 w-4" />
					Board folgen
				{:else}
					<UploadIcon class="h-4 w-4" />
					Importieren
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
