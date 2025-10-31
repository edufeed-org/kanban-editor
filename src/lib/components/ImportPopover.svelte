<script lang="ts">
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import ShareLinkPreview from './ShareLinkPreview.svelte';
	import { boardStore } from '$lib/stores/kanbanStore.svelte.js';

	let open = $state(false);
	let importMode = $state<'merge' | 'new' | 'overwrite'>('merge');
	let selectedFile = $state<File | null>(null);
	let isLoading = $state(false);
	let errorMsg = $state('');
	let successMsg = $state('');
	let isBackupFile = $state(false);  // Auto-detect: ist das eine backup.json?
	let backupStats = $state({ imported: 0, failed: 0, total: 0 });

	// Share-Link Preview State
	let showShareLinkPreview = $state(false);
	let shareLinkData = $state<any>(null);
	let shareLinkSize = $state(0);
	let maxShareLinkSize = $state(200000);

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		selectedFile = input.files?.[0] || null;
		errorMsg = '';
		successMsg = '';
		isBackupFile = false;
		backupStats = { imported: 0, failed: 0, total: 0 };
	}

	/**
	 * Auto-Detect: Prüfe ob backup.json (mit boards[]) oder einzelnes Board
	 */
	async function detectFileType(): Promise<boolean> {
		if (!selectedFile) return false;

		try {
			const jsonString = await selectedFile.text();
			const data = JSON.parse(jsonString);
			
			// Hat boards[] Array? → Backup-Datei!
			const hasBackupFormat = Array.isArray(data.boards) && data.boards.length > 0;
			isBackupFile = hasBackupFormat;
			
			if (hasBackupFormat) {
				backupStats = { 
					imported: 0, 
					failed: 0, 
					total: data.boards.length 
				};
				console.log(`🔍 Erkannt: Backup-Datei mit ${data.boards.length} Boards`);
			} else {
				console.log('🔍 Erkannt: Einzelnes Board');
			}
			
			return hasBackupFormat;
		} catch (error) {
			console.error('Fehler beim Erkennen des Dateityps:', error);
			return false;
		}
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
			const jsonString = await selectedFile.text();

			// Prüfe automatisch ob Backup-Datei
			const isBackup = await detectFileType();

			if (isBackup) {
				// BACKUP IMPORT: Alle Boards gleichzeitig wiederherstellen
				console.log('📦 Starte Batch-Restore aller Boards...');
				
				const restoreResult = boardStore.restoreAllBoardsFromBackup(jsonString);

				if (restoreResult.success) {
					successMsg = `✅ ${restoreResult.imported} Board(s) wiederhergestellt${
						restoreResult.failed > 0 
							? `, ${restoreResult.failed} Fehler` 
							: ''
					}`;
					
					console.log('📊 Wiederherstellungs-Details:', restoreResult);
					
					backupStats = {
						imported: restoreResult.imported,
						failed: restoreResult.failed,
						total: restoreResult.boards.length
					};
					
					// Reset
					selectedFile = null;
					
					// Schließe Popover nach kurzer Verzögerung
					setTimeout(() => {
						open = false;
					}, 2000);
				} else {
					errorMsg = `Wiederherstellung fehlgeschlagen: ${restoreResult.errors.join(', ')}`;
				}
				
			} else {
				// SINGLE BOARD IMPORT: Mit Mode-Auswahl
				console.log(`📄 Importiere einzelnes Board im ${importMode}-Modus...`);
				
				const result = boardStore.importBoardFromJson(jsonString, importMode);

				if (result.success && result.board) {
					try {
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
		isBackupFile = false;
		backupStats = { imported: 0, failed: 0, total: 0 };
	}

	function handleOpenChange(newOpen: boolean) {
		open = newOpen;
		if (!newOpen) {
			resetForm();
		}
	}

	// Export function for external use (from +page.svelte)
	export async function showShareLinkImportDialog(token: string) {
		try {
			console.log('📥 showShareLinkImportDialog called, token length:', token.length);
			console.log('📝 Token preview:', token.substring(0, 50) + (token.length > 50 ? '...' : ''));
			
			const parsed = boardStore.parseShareToken(token);
			console.log('✅ Token geparst erfolgreich!');
			console.log('📊 Geparste Daten:', {
				hasBoard: !!parsed.board,
				hasVersion: !!parsed.version,
				boardName: parsed.board?.name || parsed.name || 'N/A',
				boardId: parsed.board?.id || 'N/A',
				columnCount: parsed.board?.columns?.length || 0,
				cardCount: parsed.board?.columns?.reduce((sum: number, col: any) => sum + (col.cards?.length || 0), 0) || 0
			});
			
			// ⚠️ WICHTIG: parseShareToken gibt entweder { version, board: {...} } oder direkt board zurück
			// Wir müssen beide Fälle handhaben!
			const boardData = parsed.board || parsed;
			
			console.log('🎯 Board-Daten für Dialog:', {
				name: boardData.name,
				columns: boardData.columns?.length,
				cards: boardData.columns?.reduce((sum: number, col: any) => sum + (col.cards?.length || 0), 0)
			});
			
			shareLinkData = boardData;
			
			// Get token size (approximate)
			const encoded = encodeURIComponent(token);
			shareLinkSize = encoded.length;
			
			// Get max size from config
			try {
				const config = await fetch('/config.json').then(r => r.json());
				maxShareLinkSize = config.shareTokenMaxSize || 200000;
			} catch {
				maxShareLinkSize = 200000;
			}
			
			console.log('📦 Token-Größe:', { tokenSize: shareLinkSize, maxSize: maxShareLinkSize });
			console.log('🎯 Zeige ShareLinkPreview Dialog...');
			showShareLinkPreview = true;
			return true;
		} catch (error) {
			console.error('❌ Fehler beim Parsen des Share-Link-Tokens:', error);
			const parseError = error instanceof Error ? error.message : 'Unbekannter Fehler';
			console.error('📋 Fehler-Details:', { parseError, tokenLength: token.length });
			errorMsg = `Fehler beim Parsen des Share-Link-Tokens: ${parseError}`;
			return false;
		}
	}

	async function handleShareLinkImport(mode: 'merge' | 'new' | 'overwrite') {
		console.log(`📥 Importiere Share-Link im ${mode}-Modus`);
		console.log('📦 Share-Link Daten (Typ):', typeof shareLinkData, Array.isArray(shareLinkData));
		
		if (!shareLinkData) {
			errorMsg = 'Keine Board-Daten vorhanden';
			return;
		}
		
		isLoading = true;
		
		try {
			// ⚠️ shareLinkData ist ein PLAIN OBJECT (geparst vom JSON Token)
			// Nutze importBoardFromJson() das macht die Rekonstruktion automatisch!
			// WICHTIG: Die mode wird DIREKT weitergeleitet (nicht umkonvertieren!)
			
			const jsonString = JSON.stringify(shareLinkData);
			const result = boardStore.importBoardFromJson(jsonString, mode);
			
			if (result.success && result.board) {
				console.log('✅ Share-Link Board importiert (vor Speicherung):', {
					boardId: result.board?.id,
					boardName: result.board?.name,
					mode
				});
				
				// 🔥 WICHTIG: Das Board MUSS zum Store hinzugefügt werden!
				// importBoardFromJson() gibt das Board zurück, speichert es aber NICHT
				const overwrite = mode === 'overwrite';
				boardStore.saveImportedBoard(result.board, overwrite);
				
				console.log('✅ Board gespeichert im Store');
				
				// ✅ Message je nach Mode
				if (mode === 'overwrite') {
					successMsg = `✅ Board aktualisiert! ${result.board.name}`;
				} else if (mode === 'new') {
					successMsg = `✅ Neues Board importiert! ${result.board.name}`;
				} else {
					successMsg = `✅ Board zusammengeführt! ${result.board.name}`;
				}
				
				// Schließe Dialog nach kurzer Verzögerung
				setTimeout(() => {
					showShareLinkPreview = false;
					successMsg = '';
				}, 1500);
			} else {
				errorMsg = result.error || 'Import fehlgeschlagen';
			}
			
		} catch (error) {
			console.error('❌ Fehler beim Share-Link-Import:', error);
			errorMsg = `Fehler beim Import: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`;
		} finally {
			isLoading = false;
		}
	}
</script>

<Popover.Root bind:open onOpenChange={handleOpenChange}>
	<Popover.Trigger 
		type="button"
		title="Board importieren"
		class="flex rounded-md p-2 items-center justify-center gap-2 mb-2 w-full bg-primary">
		<UploadIcon class="h-4 w-4" />
		<span>Import</span>
	</Popover.Trigger>
	<Popover.Content class="w-96 p-4" side="bottom">
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
					<p class="mt-1 text-xs text-green-600">
						✓ {selectedFile.name}
						{#if isBackupFile}
							<span class="ml-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">📦 Backup ({backupStats.total} Boards)</span>
						{/if}
					</p>
				{/if}
			</div>

			<!-- Mode Selection (nur für einzelne Boards) -->
			{#if selectedFile && !isBackupFile}
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
			{/if}

			<!-- Backup Info Box (nur bei Backup-Datei) -->
			{#if isBackupFile}
				<div class="rounded bg-blue-50 p-3 text-sm border border-blue-200">
					<p class="font-medium text-blue-900">📦 Backup-Datei erkannt</p>
					<p class="text-xs text-blue-700 mt-1">
						{backupStats.total} Board(s) werden wiederhergestellt.
						{#if backupStats.failed > 0}
							<span class="text-red-600">⚠️ {backupStats.failed} mit Fehlern</span>
						{/if}
					</p>
				</div>
			{/if}

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
				<Button
					type="button"
					onclick={confirmImport}
					disabled={!selectedFile || isLoading}
					class="flex-1"
				>
					{#if isLoading}
						<span class="mr-2">⏳</span>
						{isBackupFile ? 'Stellt her...' : 'Importiert...'}
					{:else}
						<UploadIcon class="mr-2 h-4 w-4" />
						{isBackupFile ? 'Wiederherstellen' : 'Importieren'}
					{/if}
				</Button>

				<Button
					type="button"
					variant="outline"
					onclick={() => {
						open = false;
					}}
					disabled={isLoading}
				>
					Abbrechen
				</Button>
			</div>

			<!-- Help Text -->
			<p class="text-xs text-slate-500 border-t pt-2">
				💡 <strong>Tipps:</strong>
				<br/>
				• Einzelnes Board: Mit "Merge" oder "Neu" importieren
				<br/>
				• Alle Boards: Ganzes Backup automatisch wiederherstellen
			</p>
		</div>
	</Popover.Content>
</Popover.Root>

<!-- Share-Link Preview Dialog -->
<ShareLinkPreview
	open={showShareLinkPreview}
	boardData={shareLinkData}
	tokenSize={shareLinkSize}
	maxTokenSize={maxShareLinkSize}
	isLoading={isLoading}
	onConfirm={handleShareLinkImport}
	onCancel={() => {
		showShareLinkPreview = false;
		shareLinkData = null;
		isLoading = false;
	}}
/>
