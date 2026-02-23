<script lang="ts">
/**
 * /cardsboard/ Hauptseite
 * 
 * Das Board-UI (Topbar, Sidebar, Board-Komponente) wird vom gemeinsamen
 * +layout.svelte gerendert. Diese Page handhabt nur:
 * - Share-Link Import via ?import=<token> URL-Parameter
 * - Share-Link Dialog via ?share=<boardId>&author=<pubkey> URL-Parameter
 * - RequestEditorRoleDialog
 */
import { onMount } from 'svelte';
import { replaceState } from '$app/navigation';
import ImportPopover from "$lib/components/ImportPopover.svelte";
import FollowBoardDialog from "$lib/components/board/FollowBoardDialog.svelte";
import RequestEditorRoleDialog from "$lib/components/board/RequestEditorRoleDialog.svelte";
import { toast } from "svelte-sonner";

	// Reference to ImportPopover component for share-link preview
	let importPopoverComponent: any;
	
	// Share-Link Dialog State
	let showFollowDialog = $state(false);
	let shareLinkBoardId = $state<string>('');
	let shareLinkBoardAuthor = $state<string>('');

	// Handle share-link import via ?import=<token> or ?share=<boardId>&author=<pubkey> parameter
	// ✅ CORRECT: onMount for URL parameter detection (runs ONCE)
	// ⚠️ FIX: Wait for ImportPopover component to mount before proceeding (polling mechanism)
	onMount(async () => {
		try {
			const params = new URL(window.location.href).searchParams;
			const token = params.get('import');
			const shareBoardId = params.get('share');
			const shareAuthor = params.get('author');
			
			// Share-Link Detection: ?share={boardId}&author={authorPubkey}
			if (shareBoardId && shareAuthor) {
				console.log('🔗 Board Share-Link erkannt:', shareBoardId);
				shareLinkBoardId = shareBoardId;
				shareLinkBoardAuthor = shareAuthor;
				showFollowDialog = true;
				
				// Clean up URL parameters
				replaceState(window.location.pathname + window.location.hash, {});
				return;
			}
			
			if (token) {
				// ⏳ Wait for ImportPopover component to mount (race condition fix)
				// Problem: onMount runs BEFORE template components are mounted
				// Solution: Poll until importPopoverComponent is defined (max 5 seconds)
				let attempts = 0;
				const maxAttempts = 50; // 100ms * 50 = 5 seconds
				
				while (!importPopoverComponent && attempts < maxAttempts) {
					await new Promise(resolve => setTimeout(resolve, 100));
					attempts++;
				}
				
				if (importPopoverComponent) {
					// ✅ NOW safe to proceed - component is mounted
					console.log('🔗 Share-Link erkannt, zeige Preview-Dialog...');
					const success = await importPopoverComponent.showShareLinkImportDialog(token);
					
					if (success) {
						// Clean up URL param only after successful dialog show
						// Use SvelteKit's replaceState instead of history.replaceState
						replaceState(window.location.pathname + window.location.hash, {});
					} else {
						toast.error('Fehler beim Parsen des Share-Link-Tokens');
					}
				} else {
					console.error('❌ ImportPopover component nicht gefunden (timeout nach 5s)');
					toast.error('Fehler: Import-Komponente nicht bereit');
				}
			}
		} catch (e) {
			console.error('Fehler beim Verarbeiten des Import-Tokens:', e);
		}
	});
</script>

<!-- ImportPopover Component (hidden, used for share-link preview) -->
<ImportPopover bind:this={importPopoverComponent} />

<!-- FollowBoardDialog Component (shown when user opens share link via URL params) -->
<FollowBoardDialog 
	bind:open={showFollowDialog}
	boardId={shareLinkBoardId}
	boardAuthor={shareLinkBoardAuthor}
/>

<!-- RequestEditorRoleDialog Component -->
<RequestEditorRoleDialog />
