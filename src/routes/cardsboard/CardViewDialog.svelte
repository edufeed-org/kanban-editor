<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Separator from '$lib/components/ui/separator/index.js';
	import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
	import { authStore } from '$lib/stores/authStore.svelte.js';
	import ColorSelector from './ColorSelector.svelte';
	import * as Avatar from '$lib/components/ui/avatar/index.js';
	import MarkdownRenderer from '$lib/components/ui/markdown-renderer/MarkdownRenderer.svelte';
	import MarkdownEditor from '$lib/components/ui/markdown-editor/MarkdownEditor.svelte';
	import SendIcon from '@lucide/svelte/icons/send';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import EditIcon from '@lucide/svelte/icons/edit';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import WifiOffIcon from '@lucide/svelte/icons/wifi-off';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import LinkIcon from '@lucide/svelte/icons/link';
	import ImageIcon from '@lucide/svelte/icons/image';
	import OerImagePicker from '$lib/components/OerImagePicker.svelte';
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		cardId: string | number;
		open: boolean;
		onEditMode?: () => void;
		readOnly?: boolean;
	}
	let showModal = $state(false);
	let { cardId, open = $bindable(), onEditMode, readOnly = false }: Props = $props();

	let commentText = $state('');
	let isSubmitting = $state(false);
	let isLoadingComments = $state(false);
	let isCommentFieldFocused = $state(false);
	let editName = $state('');
	let selectedColor = $state('slate');
	
	// 🆕 INLINE-EDITING STATE
	let isEditingDescription = $state(false);
	let editDescription = $state('');
	let newLabelInput = $state('');
	let editLabels = $state<string[]>([]);
	let newLinkUrl = $state('');
	let newLinkTitle = $state('');
	
	// 🆕 IMAGE-EDITING STATE
	let isEditingImage = $state(false);
	let editImageUrl = $state('');
	let imageMode = $state<'url' | 'oer'>('url');
	let isAddingLink = $state(false);

	// Subscription cleanup function
	let unsubscribeComments: (() => void) | undefined;

	/**
	 * 🔥 Load existing comments THEN subscribe to real-time updates
	 * 🚀 Wait for NDK to be ready first (prevents race condition)
	 */
	onMount(async () => {
		// Guard: Ignore DnD placeholder cards (they're temporary and have no real data)
		if (String(cardId).includes('dnd-shadow-placeholder')) {
			console.debug('[CardViewDialog] Skipping DnD placeholder card:', cardId);
			return;
		}

		// Guard: Ensure card exists before loading comments
		const result = boardStore.findCardAndColumn(String(cardId));
		if (!result) {
			console.warn('[CardViewDialog] Card not found:', cardId);
			return;
		}

		// 🚀 Wait for NDK to be ready before attempting Nostr operations
		if (!boardStore.ndkReady) {
			console.debug('[CardViewDialog] Waiting for NDK to be ready...');
			// Wait up to 5 seconds for NDK
			const maxWait = 5000;
			const startTime = Date.now();
			while (!boardStore.ndkReady && (Date.now() - startTime) < maxWait) {
				await new Promise(resolve => setTimeout(resolve, 100));
			}
			
			if (!boardStore.ndkReady) {
				console.warn('[CardViewDialog] NDK not ready after timeout - skipping Nostr operations');
				return;
			}
		}

		// 1. Load existing comments from Nostr first
		await boardStore.loadComments(String(cardId));
		
		// 2. Then subscribe to new comments
		unsubscribeComments = boardStore.subscribeToComments(String(cardId));
	});

	/**
	 * 🔥 Cleanup subscription on unmount to prevent leaks
	 */
	onDestroy(() => {
		console.log('[CardViewDialog] Unmounting - cleaning up comment subscription');
		unsubscribeComments?.();
	});

	/**
	 * 🔥 Lese die Karte DIREKT aus boardStore.uiData
	 * Änderungen (z.B. neue Kommentare) sind sofort sichtbar!
	 */
	let currentCard = $derived.by(() => {
		for (const col of boardStore.uiData) {
			const found = col.items.find(c => String(c.id) === String(cardId));
			if (found) return found;
		}
		return null;
	});

	// Abgeleitete Werte
	let displayComments = $derived(currentCard?.comments || []);
	let card = $derived(currentCard || {
		id: cardId,
		name: 'Unbekannte Karte',
		description: '',
		comments: [],
		attendees: [],
		labels: [],
		color: 'slate',
		author: '',
		authorName: ''
	});

	// Sync editName und selectedColor mit Card
	$effect(() => {
		editName = card.name;
		selectedColor = card.color || 'slate';
		editDescription = card.description || '';
		editLabels = [...(card.labels || [])];
	});

	// Auto-Focus: Bei leerer Karte direkt Beschreibungs-Editor öffnen
	$effect(() => {
		if (open && !card.description && !card.image) {
			// Kurzer Timeout damit Dialog vollständig gerendert ist
			setTimeout(() => {
				isEditingDescription = true;
			}, 100);
		}
	});

	const attendees = $derived(
		card.attendees && card.attendees.length > 0
			? card.attendees
			: card.authorName
				? [card.authorName]
				: []
	);

	/**
	 * Handles comment submission
	 * 
	 * 🚀 Author-Fallback-Kette:
	 * 1. getUserName() → Nostr profile.name (z.B. "Alice")
	 * 2. getDisplayName() → "Nostr Nutzer" (wenn kein Name im Profil)
	 * 3. getPubkey() → Hex pubkey (wenn nicht eingeloggt)
	 * 4. 'anonymous' → Last resort
	 */
	async function handleAddComment() {
		if (!commentText.trim()) return;

		try {
			isSubmitting = true;
			// 🎯 Bessere Fallback-Kette: Name → Display → Pubkey → anonymous
			const author = authStore.getUserName() 
						|| authStore.getDisplayName() 
						|| authStore.getPubkey() 
						|| 'anonymous';
			boardStore.addComment(card.id as string, commentText.trim(), author);
			commentText = '';
		} catch (error) {
			console.error('❌ Fehler beim Hinzufügen des Kommentars:', error);
		} finally {
			isSubmitting = false;
		}
	}

	/**
	 * 🔥 Load remote comments from Nostr relays
	 */
	async function handleLoadComments() {
		try {
			isLoadingComments = true;
			await boardStore.loadComments(String(cardId));
			console.log('✅ Comments loaded from Nostr');
		} catch (error) {
			console.error('❌ Failed to load comments:', error);
		} finally {
			isLoadingComments = false;
		}
	}

	/**
	 * 🔥 Retry publishing a failed comment
	 */
	async function handleRetryComment(commentId: string) {
		try {
			// Find the failed comment
			const comment = displayComments.find(c => c.id === commentId);
			if (!comment) return;
			
			// Re-publish by adding it again (will trigger publish in addComment)
			// 🎯 Same fallback chain as handleAddComment
			const author = comment.author 
						|| authStore.getUserName() 
						|| authStore.getDisplayName() 
						|| authStore.getPubkey() 
						|| 'anonymous';
			
			// Delete the failed comment first
			boardStore.deleteComment(String(cardId), commentId);
			
			// Re-add it (this will trigger publish)
			boardStore.addComment(String(cardId), comment.text, author);
			
			console.log('✅ Comment retry initiated');
		} catch (error) {
			console.error('❌ Comment retry failed:', error);
		}
	}

	/**
	 * Handles comment deletion
	 */
	function handleDeleteComment(commentId: string) {
		try {
			boardStore.deleteComment(card.id as string, commentId);
		} catch (error) {
			console.error('❌ Fehler beim Löschen des Kommentars:', error);
		}
	}

	/**
	 * Generate consistent color for avatar (based on pubkey hash)
	 */
	function getAvatarColor(pubkey: string): string {
		const colors = [
			'#3b82f6',
			'#10b981',
			'#ef4444',
			'#eab308',
			'#a855f7',
			'#ec4899',
			'#6366f1',
			'#06b6d4'
		];
		const hash = pubkey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
		return colors[hash % colors.length];
	}

	/**
	 * Get initials from pubkey (first 2 chars)
	 */
	function getInitials(pubkey: string): string {
		return pubkey.slice(0, 2).toUpperCase();
	}

	/**
	 * ✅ OPTIMIZED (Phase 1): Dual-Field Author Attribution
	 * - Priority 1: Use authorName (stored display name, fastest - NO Nostr lookup!)
	 * - Priority 2: Use authStore.getDisplayNameForPubkey() (async fetch from Nostr)
	 * - Short name (< 20 chars): Display full (e.g. "Alice", "Bob")
	 * - Long pubkey: Fetch from Nostr or truncate to first 8 + last 4 chars
	 * - Caches profiles for performance
	 * 
	 * @param author - Pubkey (hex) or name string
	 * @param authorName - Optional display name (from Comment.authorName field)
	 * @returns Readable display name
	 */
	function formatAuthorName(author: string, authorName?: string): string {
		if (!author) return 'Anonym';
		
		// ⚡ NEW (Phase 1): Prefer stored authorName (no lookup needed!)
		if (authorName) {
			return authorName;
		}
		
		// Short name (< 20 chars) → display full (likely already a name)
		if (author.length < 20) {
			return author;
		}
		
		// Long pubkey → fetch from authStore (with cache + async fetch)
		return authStore.getDisplayNameForPubkey(author);
	}

	/**
	 * Handle card rename
	 */
	function handleRenameChange() {
		if (editName.trim() && editName !== card.name) {
			boardStore.updateCard(card.id as string, { heading: editName });
		}
	}

	/**
	 * Handle color change
	 */
	function handleColorChange(colorValue: string) {
		boardStore.updateCard(card.id as string, { color: colorValue });
	}
	
	// ============================================================================
	// 🆕 INLINE-EDITING FUNKTIONEN
	// ============================================================================
	
	/**
	 * Beschreibung speichern und Editor schließen
	 */
	function handleSaveDescription() {
		boardStore.updateCard(card.id as string, { content: editDescription });
		isEditingDescription = false;
	}
	
	/**
	 * Beschreibung bearbeiten abbrechen
	 */
	function handleCancelDescription() {
		editDescription = card.description || '';
		isEditingDescription = false;
	}
	
	/**
	 * Label hinzufügen
	 */
	function handleAddLabel() {
		const trimmedLabel = newLabelInput.trim();
		if (trimmedLabel && !editLabels.includes(trimmedLabel)) {
			const updatedLabels = [...editLabels, trimmedLabel];
			editLabels = updatedLabels;
			boardStore.updateCard(card.id as string, { labels: updatedLabels });
			newLabelInput = '';
		}
	}
	
	/**
	 * Label entfernen
	 */
	function handleRemoveLabel(labelToRemove: string) {
		const updatedLabels = editLabels.filter(label => label !== labelToRemove);
		editLabels = updatedLabels;
		boardStore.updateCard(card.id as string, { labels: updatedLabels });
	}
	
	/**
	 * Label Keyboard handler
	 */
	function handleLabelKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			handleAddLabel();
		}
	}
	
	/**
	 * Link hinzufügen
	 */
	function handleAddLink() {
		if (!newLinkUrl.trim() || !newLinkTitle.trim()) return;
		
		const newLink = {
			id: crypto.randomUUID(),
			url: newLinkUrl.trim(),
			title: newLinkTitle.trim()
		};
		
		const currentLinks = card.links || [];
		const updatedLinks = [...currentLinks, newLink];
		boardStore.updateCard(card.id as string, { links: updatedLinks });
		
		newLinkUrl = '';
		newLinkTitle = '';
		isAddingLink = false;
	}
	
	/**
	 * Link entfernen (per Index)
	 */
	function handleRemoveLink(index: number) {
		const currentLinks = card.links || [];
		const updatedLinks = currentLinks.filter((_, i) => i !== index);
		boardStore.updateCard(card.id as string, { links: updatedLinks });
	}

	function handleEditClick() {
		showModal = true;
	}

	function getCardColor(colorName: string | undefined): string {
		return colorName ? `var(--color-${colorName})` : 'var(--muted)';
	}

	/**
	 * Switch to edit mode - closes view dialog and triggers edit dialog
	 * Now allows both authenticated and anonymous users to edit
	 */
	function switchToEditMode() {
		open = false;
		onEditMode?.();
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content 
		class="w-full max-w-3xl sm:max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0"
		showCloseButton={false}
		style="border-bottom: 5px solid {getCardColor(selectedColor)};"
	>
		<!-- Header: 2 Zeilen Layout -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div 
			role="presentation"
			class="px-6 py-4 border-b bg-background space-y-3"
			onclick={() => {
				// Schließe Editor wenn auf Header geklickt wird
				if (isEditingDescription) {
					handleSaveDescription();
				}
			}}
		>
			<!-- Zeile 1: Heading (links) | Delete + Close Button (rechts) -->
			<div class="flex items-center justify-between gap-4">
					<!-- Author Avatar  {@const} müssen innerhalb von {#if} stehen -->
				{#if true}
					{@const authorName = card.authorName || 'Nostr Nutzer:in'}
					{@const authorPubkey = card.author}
					<Avatar.Root class="h-8 w-8 flex-shrink-0">
						<Avatar.Fallback class="{Avatar.getAvatarColor(authorPubkey)} text-white text-xs font-semibold">
							{Avatar.getInitials(authorName)}
						</Avatar.Fallback>
					</Avatar.Root>
				{/if}
				<input
					type="text"
					bind:value={editName}
					onblur={readOnly ? undefined : handleRenameChange}
					onkeydown={readOnly ? undefined : (e) => e.key === 'Enter' && handleRenameChange()}
					disabled={readOnly}
					class="text-xl font-semibold bg-transparent border-none outline-none flex-1 min-w-0 focus:ring-2 focus:ring-primary/20 rounded px-1 -ml-1 {readOnly ? '' : 'hover:bg-muted/50'} transition-colors {readOnly ? 'cursor-default' : ''}"
					placeholder="Kartentitel eingeben..."
				/>
				<div class="flex items-center gap-1 flex-shrink-0">
					{#if !readOnly}
					<Button 
						variant="ghost" 
						size="sm"
						onclick={() => {
							if (confirm('Möchtest du diese Karte wirklich löschen?')) {
								boardStore.deleteCard(String(card.id));
								open = false;
							}
						}}
						class="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
						aria-label="Karte löschen"
					>
						<TrashIcon class="h-4 w-4" />
					</Button>
					{/if}
					<Button 
						variant="ghost" 
						size="sm"
						onclick={() => open = false}
						class="h-8 w-8 p-0"
						aria-label="Dialog schließen"
					>
						<XIcon class="h-4 w-4" />
					</Button>
				</div>
			</div>

			<!-- Zeile 2: Labels (links) | ColorPicker (rechts) -->
			<div class="flex items-center justify-between gap-4">
				<!-- Labels -->
				<div class="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
					{#each editLabels as label}
						<Badge 
							variant="secondary" 
							class="text-xs px-2 py-1 bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100 flex items-center gap-1 group"
						>
							{label}
							{#if !readOnly}
							<button
								onclick={() => handleRemoveLabel(label)}
								class="opacity-0 group-hover:opacity-100 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-opacity"
								aria-label="Label entfernen"
							>
								<XIcon class="h-3 w-3" />
							</button>
							{/if}
						</Badge>
					{/each}
					
					<!-- Inline Add Label (hidden in readOnly mode) -->
					{#if !readOnly}
					<div class="flex items-center gap-1">
						<Input 
							bind:value={newLabelInput} 
							placeholder="+ Label"
							onkeydown={handleLabelKeyDown}
							class="h-6 w-20 text-xs px-2 border-dashed focus:w-32 transition-all"
						/>
						{#if newLabelInput.trim()}
							<Button 
								variant="ghost" 
								size="sm"
								onclick={handleAddLabel}
								class="h-6 w-6 p-0"
							>
								<PlusIcon class="h-3 w-3" />
							</Button>
						{/if}
					</div>
					{/if}
				</div>

				<!-- Color Selector (hidden in readOnly mode) -->
				{#if !readOnly}
				<div class="flex items-center gap-3 flex-shrink-0">
					<ColorSelector 
						selectedColor={selectedColor} 
						onColorChange={(colorValue) => {
							selectedColor = colorValue;
							handleColorChange(colorValue);
						}} 
						compact={true}
					/>
					
				
				</div>
				{/if}
			</div>
		</div>

		<!-- Main Content: Scrollable (Scroll-Lock wenn Editor aktiv) -->
		<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
		<div 
			role="presentation"
			class="flex-1 px-6 py-4 space-y-4 {isEditingDescription ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}"
			onclick={(e) => {
				// Schließe Editor wenn außerhalb des Description-Bereichs geklickt wird
				if (isEditingDescription) {
					const target = e.target as HTMLElement;
					const descriptionSection = document.querySelector('[data-description-section]');
					if (descriptionSection && !descriptionSection.contains(target)) {
						handleSaveDescription();
					}
				}
			}}
		>
			<!-- Image Section (ausgeblendet während Description-Editor aktiv) -->
			{#if !isEditingDescription}
				<div class="space-y-2">
					{#if !isEditingImage && !card.image}
						<!-- Kein Bild: Button zum Hinzufügen (hidden in readOnly mode) -->
						{#if !readOnly}
						<div class="flex items-center justify-between">
							<h3 class="text-sm font-semibold text-muted-foreground">Karteninhalt</h3>
							<Button
								variant="outline"
								size="sm"
								onclick={() => {
									isEditingImage = true;
									editImageUrl = '';
									imageMode = 'url';
								}}
								class="h-7 px-2 text-xs text-muted-foreground"
							>
								<ImageIcon class="h-3 w-3 mr-1" />
								Bild hinzufügen
							</Button>
						</div>
						{/if}
					{/if}

					{#if isEditingImage && !readOnly}
						<!-- Edit Mode: URL oder OER -->
						<div class="space-y-3 p-3 border rounded-md bg-muted/30">
							<!-- Mode Toggle -->
							<div class="flex gap-1">
								<Button
									type="button"
									variant={imageMode === 'url' ? 'default' : 'outline'}
									size="sm"
									onclick={() => (imageMode = 'url')}
								>
									URL eingeben
								</Button>
								<Button
									type="button"
									variant={imageMode === 'oer' ? 'default' : 'outline'}
									size="sm"
									onclick={() => (imageMode = 'oer')}
								>
									OER suchen
								</Button>
							</div>

							{#if imageMode === 'url'}
								<!-- URL Input -->
								<div class="flex gap-2">
									<Input
										bind:value={editImageUrl}
										placeholder="https://example.com/image.jpg"
										class="flex-1"
									/>
								</div>
								
								<!-- URL Preview -->
								{#if editImageUrl && editImageUrl !== card.image}
									<div class="rounded-md overflow-hidden bg-muted border-2 border-blue-400">
										<img
											src={editImageUrl}
											alt="Vorschau"
											class="w-full h-auto max-h-48 object-contain"
											onerror={(e) => {
												(e.target as HTMLImageElement).style.display = 'none';
											}}
										/>
										<div class="text-xs text-muted-foreground p-1 text-center bg-blue-400/20">
											Vorschau - noch nicht gespeichert
										</div>
									</div>
								{/if}
							{:else}
								<!-- OER Picker -->
								<OerImagePicker
									onSelect={(url) => {
										editImageUrl = url;
										imageMode = 'url';
									}}
								/>
							{/if}

							<!-- Action Buttons -->
							<div class="flex justify-between items-center pt-2 border-t">
								<div>
									{#if card.image}
										<Button
											variant="ghost"
											size="sm"
											onclick={() => {
												boardStore.editCard(String(card.id), { image: '' });
												isEditingImage = false;
											}}
											class="text-destructive hover:text-destructive"
										>
											<TrashIcon class="h-3 w-3 mr-1" />
											Bild entfernen
										</Button>
									{/if}
								</div>
								<div class="flex gap-2">
									<Button
										variant="ghost"
										size="sm"
										onclick={() => {
											isEditingImage = false;
											editImageUrl = '';
										}}
									>
										Abbrechen
									</Button>
									<Button
										size="sm"
										onclick={() => {
											if (editImageUrl !== card.image) {
												boardStore.editCard(String(card.id), { image: editImageUrl });
											}
											isEditingImage = false;
										}}
										disabled={!editImageUrl && !card.image}
									>
										<CheckIcon class="h-3 w-3 mr-1" />
										Speichern
									</Button>
								</div>
							</div>
						</div>
					{/if}

					{#if card.image && !isEditingImage}
						<!-- Display Mode: Bild anzeigen mit Hover-Edit -->
						<div class="relative group">
							<div class="rounded-md overflow-hidden max-h-96 bg-muted border">
								<img
									src={card.image}
									alt="Kartenbild"
									class="w-full h-full object-cover"
									onerror={(e) => {
										(e.target as HTMLImageElement).style.display = 'none';
									}}
								/>
							</div>
							<!-- Edit-Button Overlay (hidden in readOnly mode) -->
							{#if !readOnly}
							<Button
								variant="secondary"
								size="sm"
								onclick={() => {
									isEditingImage = true;
									editImageUrl = card.image || '';
									imageMode = 'url';
								}}
								class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2 text-xs"
							>
								<PencilIcon class="h-3 w-3 mr-1" />
								Ändern
							</Button>
							{/if}
						</div>
					{/if}
				</div>
			{/if}

			<!-- 🆕 Description mit TipTap-Editor (automatisch bei Focus/Blur) -->
			<div 
				class="{isEditingDescription ? 'flex-1 flex flex-col min-h-0' : ''}"
				data-description-section
			>
				
				{#if isEditingDescription}
					<!-- TipTap Markdown Editor - wird bei Blur automatisch gespeichert -->
					<div 
						class="flex-1 flex flex-col min-h-0"
						onfocusout={(e) => {
							// Nur schließen wenn der Focus wirklich den Editor verlässt
							const relatedTarget = e.relatedTarget as HTMLElement | null;
							const container = e.currentTarget as HTMLElement;
							
							// Wenn relatedTarget null ist oder außerhalb des Containers liegt → schließen
							if (!relatedTarget || !container.contains(relatedTarget)) {
								// Kleiner Timeout um sicherzustellen, dass der Focus wirklich weg ist
								// (TipTap hat manchmal interne Focus-Wechsel)
								setTimeout(() => {
									// Prüfe nochmal ob der Focus wirklich außerhalb ist
									if (!container.contains(document.activeElement)) {
										handleSaveDescription();
									}
								}, 50);
							}
						}}
					>
						<MarkdownEditor 
							value={editDescription}
							placeholder="Beschreibung eingeben..."
							fullHeight={true}
							onchange={(content) => editDescription = content}
						/>
					</div>
				{:else if card.description}
					<!-- Markdown-Anzeige - bei Klick wird Editor aktiviert (nur wenn nicht readOnly) -->
					{#if readOnly}
						<div class="min-h-[7.5rem] p-3 bg-muted/50 rounded-md text-sm border border-[var(--ring)] transition-colors">
							<MarkdownRenderer content={card.description} />
						</div>
					{:else}
						<button 
							type="button"
							class="w-full text-left min-h-[7.5rem] p-3 bg-muted/50 rounded-md text-sm border border-[var(--ring)] cursor-text hover:bg-muted/70 transition-colors"
							onclick={() => isEditingDescription = true}
							aria-label="Beschreibung bearbeiten"
						>
							<MarkdownRenderer content={card.description} />
						</button>
					{/if}
				{:else}
					<!-- Platzhalter - bei Klick wird Editor aktiviert (nur wenn nicht readOnly) -->
					{#if !readOnly}
					<div 
						class="p-3 bg-muted/30 rounded-md text-sm border border-dashed cursor-text hover:bg-muted/50 transition-colors text-muted-foreground"
						onclick={() => isEditingDescription = true}
						onfocusin={() => isEditingDescription = true}
						onkeydown={(e) => e.key === 'Enter' && (isEditingDescription = true)}
						role="textbox"
						tabindex="0"
						aria-label="Beschreibung hinzufügen"
					>
						Inhalt hinzufügen...
					</div>
					{:else}
					<p class="text-sm text-muted-foreground italic">Keine Beschreibung vorhanden</p>
					{/if}
				{/if}
			</div>

			<!-- 🆕 Links Section mit Inline-Add (ausgeblendet während Editor aktiv) -->
			{#if !isEditingDescription}
			<div class="space-y-2">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-semibold text-muted-foreground">Links</h3>
					{#if !readOnly}
					<Button
						variant="ghost"
						size="sm"
						onclick={() => isAddingLink = !isAddingLink}
						class="h-6 px-2 text-xs"
					>
						<PlusIcon class="h-3 w-3 mr-1" />
						Link hinzufügen
					</Button>
					{/if}
				</div>
				
				{#if isAddingLink && !readOnly}
					<div class="flex flex-col gap-2 p-3 bg-muted/30 rounded-md border border-dashed">
						<Input 
							bind:value={newLinkTitle} 
							placeholder="Titel"
							class="text-sm"
						/>
						<Input 
							bind:value={newLinkUrl} 
							placeholder="https://..."
							class="text-sm"
						/>
						<div class="flex justify-end gap-2">
							<Button variant="outline" size="sm" onclick={() => { isAddingLink = false; newLinkUrl = ''; newLinkTitle = ''; }}>
								Abbrechen
							</Button>
							<Button size="sm" onclick={handleAddLink} disabled={!newLinkUrl.trim() || !newLinkTitle.trim()}>
								<PlusIcon class="h-4 w-4 mr-1" />
								Hinzufügen
							</Button>
						</div>
					</div>
				{/if}
				
				{#if card.links && card.links.length > 0}
				<div class="space-y-2">
						{#each card.links as link, index (link.id || `link-${index}`)}
							<div class="group flex items-center gap-2 p-2 bg-muted/50 rounded-md hover:bg-muted transition-colors border text-sm">
								<a
									href={link.url}
									target="_blank"
									rel="noopener noreferrer"
									class="flex items-center gap-2 flex-1 min-w-0"
									onclick={(e) => e.stopPropagation()}
								>
									<LinkIcon class="h-4 w-4 flex-shrink-0 text-muted-foreground" />
									<div class="flex-1 min-w-0">
										<div class="font-medium truncate">{link.title}</div>
										<div class="text-xs text-muted-foreground truncate">{link.url}</div>
									</div>
								</a>
								{#if !readOnly}
								<button
									type="button"
									onclick={() => handleRemoveLink(index)}
									class="p-1 rounded hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
									title="Link entfernen"
								>
									<XIcon class="h-3.5 w-3.5" />
								</button>
								{/if}
							</div>
						{/each}
					</div>
			{:else if !isAddingLink}
				{#if !readOnly}
				<div 
					class="p-3 bg-muted/30 rounded-md text-sm border border-dashed cursor-pointer hover:bg-muted/50 transition-colors text-muted-foreground text-center"
					onclick={() => isAddingLink = true}
					role="button"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && (isAddingLink = true)}
				>
					Klicken um Link hinzuzufügen...
				</div>
				{:else}
				<div class="p-3 bg-muted/30 rounded-md text-sm border border-dashed text-muted-foreground text-center">
					Keine Links vorhanden
				</div>
				{/if}
				{/if}
			</div>
			{/if}
			<!-- Ende der ausgeblendeten Sections während Editor aktiv -->

			<!-- Attendees / AvatarStack - mit Popover auf Avatar Click (ausgeblendet während Editor aktiv) -->
			{#if attendees.length > 0 && !isEditingDescription}
				<div class="space-y-2">
					<h3 class="text-sm font-semibold text-muted-foreground">Teilnehmer</h3>
					<div class="flex items-center gap-3">
						<!-- Clickable Avatars mit Popover -->
						<div class="flex -space-x-3">
							{#each attendees.slice(0, 5) as author}
								<Popover.Root>
									<Popover.Trigger
										class="avatar w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white border-2 border-background cursor-pointer hover:z-50 transition-transform hover:scale-110"
										style="background-color: {getAvatarColor(author)}"
										title={author}
										type="button"
									>
										{getInitials(author)}
									</Popover.Trigger>
									<Popover.Content side="top" align="center" class="w-48">
										<div class="space-y-2">
											<div class="text-sm font-semibold px-2 py-1">
												{card.authorName || 'Teilnehmer'}
											</div>
											<div class="text-xs text-muted-foreground px-2 font-mono break-all">
												{author}
											</div>
										</div>
									</Popover.Content>
								</Popover.Root>
							{/each}
						</div>

						<span class="text-xs text-muted-foreground">
							{attendees.length} {attendees.length === 1 ? 'Person' : 'Personen'}
						</span>
					</div>
				</div>
			{/if}

			{#if !isEditingDescription}
			<!-- Divider -->
			<div class="my-2 border-t"></div>

			<!-- Comments Section Header with Load Button -->
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-semibold text-muted-foreground">
					Kommentare ({displayComments.length})
				</h3>
				<!-- 🚀 Phase 4B: Load Comments button entfernt - Auto-Load aktiv -->
			</div>

			<!-- Existing Comments List -->
			{#if displayComments.length > 0}
				<div class="space-y-3">
					{#each displayComments as comment, index (comment.id || `comment-${index}`)}
						<div class="flex gap-3">
							<!-- Avatar Links - mit Popover -->
							<Popover.Root>
								<Popover.Trigger
									class="avatar w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white border border-border flex-shrink-0 cursor-pointer hover:scale-110 transition-transform"
									style="background-color: {getAvatarColor(comment.author)}"
									title={comment.author}
									type="button"
								>
									{getInitials(comment.author)}
								</Popover.Trigger>
								<Popover.Content side="top" align="start" class="w-48">
									<div class="space-y-2">
										<!-- 🚀 Show formatted name (truncated if pubkey) -->
										<div class="text-sm font-semibold px-2 py-1">
											{formatAuthorName(comment.author, comment.authorName)}
										</div>
										<!-- Full pubkey in small text (for copy-paste) -->
										<div class="text-xs text-muted-foreground px-2 font-mono break-all">
											{comment.author}
										</div>
									</div>
								</Popover.Content>
							</Popover.Root>

							<!-- Kommentar-Inhalt -->
							<div class="flex-1 min-w-0 space-y-2">
								<div class="flex justify-between items-start gap-2">
									<div class="flex-1 min-w-0">
										<div class="flex items-center gap-2">
											<!-- 🚀 Show formatted name instead of raw pubkey -->
											<span class="font-medium text-sm">{formatAuthorName(comment.author, comment.authorName)}</span>
											
											<!-- 🔥 Sync Status Icon -->
											{#if comment.syncStatus === 'syncing'}
												<span title="Wird synchronisiert...">
													<LoaderIcon class="h-3 w-3 animate-spin text-blue-500" />
												</span>
											{:else if comment.syncStatus === 'synced'}
												<span title="Synchronisiert">
													<CheckIcon class="h-3 w-3 text-green-500" />
												</span>
											{:else if comment.syncStatus === 'failed'}
												<span title="Synchronisation fehlgeschlagen">
													<CircleAlertIcon class="h-3 w-3 text-red-500" />
												</span>
											{:else if comment.syncStatus === 'local'}
												<span title="Nur lokal (Offline)">
													<WifiOffIcon class="h-3 w-3 text-amber-500" />
												</span>
											{/if}
										</div>
										<div class="text-xs text-muted-foreground">
											{new Date(comment.createdAt).toLocaleDateString('de-DE', {
												year: 'numeric',
												month: '2-digit',
												day: '2-digit',
												hour: '2-digit',
												minute: '2-digit'
											})}
										</div>
									</div>
									
									<!-- Action Buttons: Retry (if failed) + Delete (hidden in readOnly mode) -->
									{#if !readOnly}
									<div class="flex gap-1">
										{#if comment.syncStatus === 'failed'}
											<Button
												variant="ghost"
												size="sm"
												onclick={() => handleRetryComment(comment.id || `fallback-${index}`)}
												class="h-6 w-6 p-0 text-amber-600 hover:text-amber-700"
												title="Erneut versuchen"
											>
												<RefreshCwIcon class="size-3" />
											</Button>
										{/if}
										<Button
											variant="ghost"
											size="sm"
											onclick={() => handleDeleteComment(comment.id || `fallback-${index}`)}
											class="btn text-destructive bg-destructive h-6 w-6 p-0"
										>
											<TrashIcon class="size-3" />
										</Button>
									</div>
									{/if}
								</div>
								<p class="text-sm text-foreground whitespace-pre-wrap break-words">
									{comment.text}
								</p>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-muted-foreground text-center py-4">Keine Kommentare vorhanden</p>
			{/if}

			<!-- Comment Input Form (hidden in readOnly mode) -->
			{#if !readOnly}
			<div class="space-y-3">
				<Textarea
					placeholder="Schreibe einen Kommentar..."
					bind:value={commentText}
					disabled={isSubmitting}
					class="min-h-20 resize-none"
					onfocus={() => (isCommentFieldFocused = true)}
					onblur={() => (isCommentFieldFocused = false)}
				/>
				<div class="flex justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						class="gap-2 bg-secondary"
						onclick={() => (commentText = '')}
						disabled={isSubmitting || (!isCommentFieldFocused && !commentText.trim())}
					>
						Abbrechen
					</Button>
					<Button
						size="sm"
						onclick={handleAddComment}
						disabled={isSubmitting || !commentText.trim()}
						class="gap-2 bg-primary"
					>
						{#if isSubmitting}
							<LoaderIcon class="h-4 w-4 animate-spin" />
							<span>Wird gesendet...</span>
						{:else}
							<SendIcon class="h-4 w-4" />
							<span>Absenden</span>
						{/if}
					</Button>
				</div>
			</div>
			{/if}
			{/if}
		</div>

		<!-- Footer: Edit Button (statt Schließen, da Dialog selbst Close hat) -->
		<!-- <div class="px-6 py-4 border-t bg-muted/20 flex gap-2">
			<Button 
				variant="outline" 
				size="sm"
				class="gap-2 bg-primary"
				onclick={switchToEditMode}
			>
				<EditIcon class="h-4 w-4" />
				<span>Bearbeiten</span>
			</Button>
		</div> -->
	</Dialog.Content>
</Dialog.Root>
