<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import FileTextIcon from '@lucide/svelte/icons/file-text';
	import { boardStore } from '$lib/stores/kanbanStore.svelte';
	import { boardToLiaScript, generateLiaScriptFilename } from '$lib/utils/liascriptExport';

	function handleExport() {
		try {
			const board = boardStore.data;
			if (!board) {
				console.error('❌ Kein Board geladen');
				return;
			}

			// Markdown generieren
			const markdown = boardToLiaScript(board, true);

			// Dateinamen generieren
			const filename = generateLiaScriptFilename(board.name || 'board');

			// Download starten
			const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			link.click();
			URL.revokeObjectURL(url);

			console.log('✅ LiaScript Export erfolgreich:', filename);
		} catch (error) {
			console.error('❌ LiaScript Export fehlgeschlagen:', error);
		}
	}
</script>

<Button
	variant="ghost"
	size="sm"
	onclick={handleExport}
	title="Board als LiaScript Markdown exportieren"
>
	<FileTextIcon class="mr-2 h-4 w-4" />
	<span class="hidden sm:inline">LiaScript</span>
</Button>
