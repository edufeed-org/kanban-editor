<script lang="ts">
	import DownloadIcon from '@lucide/svelte/icons/download';
	import { boardStore } from '$lib/stores/kanbanStore.svelte';

	// Wird von Parent (CardViewDialog) kontrolliert
	let { onclick }: { onclick?: () => void } = $props();

	function downloadBoardAsJson() {
		try {
			// Exportiere aktuelles Board mit Metadaten
			const jsonString = boardStore.exportBoardAsJson(true);

			// Erstelle Blob
			const blob = new Blob([jsonString], { type: 'application/json' });
			const url = URL.createObjectURL(blob);

			// Generiere Dateiname: {BoardName}_{date}.json
			const boardName = boardStore.data.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
			const dateStr = new Date().toISOString().split('T')[0];
			const filename = `${boardName}_${dateStr}.json`;

			// Starte Browser Download
			const a = document.createElement('a');
			a.href = url;
			a.download = filename;
			document.body.appendChild(a);
			a.click();

			// Cleanup
			document.body.removeChild(a);
			URL.revokeObjectURL(url);

			console.log('✅ Board exportiert:', filename);
		} catch (error) {
			console.error('❌ Export fehlgeschlagen:', error);
		}
	}

	function handleClick() {
		downloadBoardAsJson();
		if (onclick) {
			onclick(); // Parent kann zusätzliche Actions ausführen (z.B. Dialog schließen)
		}
	}
</script>

<button
	type="button"
	title="Board als JSON exportieren"
	onclick={handleClick}
	class="inline-flex items-center justify-center p-2 text-sm font-medium rounded-md hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
	<DownloadIcon class="h-4 w-4" />
</button>
