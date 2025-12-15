<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { toast } from 'svelte-sonner';
	import { boardStore } from '$lib/stores/kanbanStore.svelte';
	import {
		boardToLiaScript,
		generateLiaScriptFilename,
		publishBoardAsLiaScriptToNostr
	} from '$lib/utils/liascriptExport';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import ShareIcon from '@lucide/svelte/icons/share-2';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CheckIcon from '@lucide/svelte/icons/check';

	// Props
	let { open = $bindable(false) } = $props();

	// State
	let isPublishing = $state(false);
	let publishedLink = $state<string | null>(null);
	let linkCopied = $state(false);

	const board = $derived(boardStore.data);

	// Download als Markdown-Datei
	function handleDownload() {
		try {
			if (!board) {
				toast.error('Kein Board geladen');
				return;
			}

			const markdown = boardToLiaScript(board, true);
			const filename = generateLiaScriptFilename(board.name || 'board');

			const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = filename;
			link.click();
			URL.revokeObjectURL(url);

			toast.success(`Datei heruntergeladen: ${filename}`);
			open = false;
		} catch (error) {
			console.error('Download fehlgeschlagen:', error);
			toast.error('Download fehlgeschlagen');
		}
	}

	// Publiziere zu Nostr und erhalte Link
	async function handlePublishToNostr() {
		if (!board) {
			toast.error('Board nicht verfügbar');
			return;
		}

		isPublishing = true;
		publishedLink = null;

		try {
			const link = await publishBoardAsLiaScriptToNostr(board, boardStore);

			if (link) {
				publishedLink = link;
				toast.success('Board erfolgreich publiziert!');
			} else {
				toast.error('Publishing fehlgeschlagen');
			}
		} catch (error) {
			console.error('Publishing error:', error);
			toast.error('Fehler beim Publizieren');
		} finally {
			isPublishing = false;
		}
	}

	// Link kopieren
	function copyLink() {
		if (publishedLink) {
			navigator.clipboard.writeText(publishedLink);
			linkCopied = true;
			toast.success('Link kopiert!');
			setTimeout(() => {
				linkCopied = false;
			}, 2000);
		}
	}

	// Reset beim Schließen
	function resetAndClose() {
		publishedLink = null;
		linkCopied = false;
		open = false;
	}
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => !isOpen && resetAndClose()}>
	<Dialog.Content class="sm:max-w-[500px]">
		<Dialog.Header>
			<Dialog.Title>LiaScript Export</Dialog.Title>
			<Dialog.Description>
				Wähle eine Export-Option für dein Board
			</Dialog.Description>
		</Dialog.Header>

		{#if !publishedLink}
			<!-- Initial State: Zwei Export-Optionen -->
			<div class="grid gap-4 py-4">
				<!-- Option 1: Als Markdown-Datei herunterladen -->
				<Button onclick={handleDownload} variant="outline" class="h-auto py-4">
					<div class="flex flex-col items-center gap-2 w-full">
						<DownloadIcon class="h-6 w-6" />
						<div class="text-center">
							<div class="font-semibold">Als Markdown-Datei herunterladen</div>
							<div class="text-xs text-muted-foreground mt-1">
								Board als .md-Datei exportieren
							</div>
						</div>
					</div>
				</Button>

				<!-- Option 2: Als Nostr-Event publizieren -->
				<Button
					onclick={handlePublishToNostr}
					disabled={isPublishing}
					variant="outline"
					class="h-auto py-4"
				>
					<div class="flex flex-col items-center gap-2 w-full">
						{#if isPublishing}
							<LoaderIcon class="h-6 w-6 animate-spin" />
						{:else}
							<ShareIcon class="h-6 w-6" />
						{/if}
						<div class="text-center">
							<div class="font-semibold">Als Nostr-Event publizieren</div>
							<div class="text-xs text-muted-foreground mt-1">
								{#if isPublishing}
									Publishing...
								{:else}
									Board teilen und Link erhalten
								{/if}
							</div>
						</div>
					</div>
				</Button>
			</div>
		{:else}
			<!-- Success State: Link anzeigen -->
			<div class="grid gap-4 py-4">
				<div class="space-y-2">
					<label for="liascript-viewer-link" class="text-sm font-medium">LiaScript Viewer Link</label>
					<div class="flex gap-2">
						<Input id="liascript-viewer-link" value={publishedLink} readonly class="font-mono text-xs" />
						<Button onclick={copyLink} variant="outline" size="icon">
							{#if linkCopied}
								<CheckIcon class="h-4 w-4 text-green-600" />
							{:else}
								<CopyIcon class="h-4 w-4" />
							{/if}
						</Button>
					</div>
					<p class="text-xs text-muted-foreground">
						Teile diesen Link, um dein Board in LiaScript zu öffnen
					</p>
				</div>
			</div>

			<Dialog.Footer>
				<Button onclick={resetAndClose} variant="outline">Schließen</Button>
			</Dialog.Footer>
		{/if}
	</Dialog.Content>
</Dialog.Root>
