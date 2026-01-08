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
	import PublishStateToggle from './PublishStateToggle.svelte';
	import MarkdownEditor from '$lib/components/ui/markdown-editor/MarkdownEditor.svelte';
	import SendIcon from '@lucide/svelte/icons/send';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import EditIcon from '@lucide/svelte/icons/edit';
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import UserIcon from '@lucide/svelte/icons/user';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import WifiOffIcon from '@lucide/svelte/icons/wifi-off';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import type { CardItem } from './types.js';
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		cardId: string | number;
		open: boolean;
	}
	let showModal = $state(false);
	let { cardId, open = $bindable() }: Props = $props();

	let commentText = $state('');
	let isSubmitting = $state(false);
	let isLoadingComments = $state(false);
	let selectedAuthorPopover = $state<string | null>(null);
	let editName = $state('');
	let selectedColor = $state('slate');
	let localPublishState = $state<'draft' | 'published'>('draft');

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
		publishState: 'draft' as const,
		author: '',
		authorName: ''
	});

	// Sync localPublishState und editName mit Card
	$effect(() => {
		editName = card.name;
		selectedColor = card.color || 'slate';
		localPublishState = (card.publishState || 'draft') as 'draft' | 'published';
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
	 * Toggle publish state: draft → published → draft
	 */
	function handlePublishToggle() {
		const states: ('draft' | 'published')[] = ['draft', 'published'];
		const currentIndex = states.indexOf(localPublishState);
		const nextIndex = (currentIndex + 1) % states.length;
		localPublishState = states[nextIndex];
		boardStore.updateCard(card.id as string, { publishState: localPublishState });
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
	function handleEditClick() {
		showModal = true;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0">
		<!-- Header: Title + Settings Popover (PublishToggle rechts wie auf Card) -->
		<div class="px-6 py-4 border-b bg-background">
			<div class="flex items-start justify-between gap-4 mb-2">
				<!-- Left: Title -->
				<h2 class="text-xl font-semibold flex-1">{card.name}</h2>
				
				<!-- Right: PublishToggle + Settings Popover (wie Card.svelte) -->
				<div class="flex items-center gap-2 flex-shrink-0">
					<PublishStateToggle value={localPublishState} onToggle={handlePublishToggle} />
					<Popover.Root>
						<Popover.Trigger class="mr-4 pl-1 w-6 h-6 btn bg-primary" type="button" title="Kartenoptionen" >
							<EllipsisVerticalIcon class="h-4 w-4" />
						</Popover.Trigger>
					<Popover.Content align="end" side="bottom" class="w-72">
						<div class="space-y-4">
							
							<!-- Card Rename -->
							<div class="space-y-2">
								<h4 class="font-medium text-sm">Karte umbenennen</h4>
								<Input 
									bind:value={editName} 
									placeholder="Kartenname"
									onchange={handleRenameChange}
									onblur={handleRenameChange}
									class="text-sm"
								/>
							</div>
							
							<Separator.Root class="my-3" />
							
							<!-- Color Selector -->
							<ColorSelector selectedColor={selectedColor} onColorChange={(colorValue) => {
								selectedColor = colorValue;
								handleColorChange(colorValue);
							}} />
						</div>
					</Popover.Content>
				</Popover.Root>
				</div>
			</div>

			<!-- Badges -->
			{#if card.labels && card.labels.length > 0}
				<div class="flex flex-wrap gap-1.5">
					{#each card.labels.slice(0, 3) as label}
						<Badge variant="secondary" class="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100">
							{label}
						</Badge>
					{/each}
					{#if card.labels.length > 3}
						<Badge variant="outline" class="text-xs px-1.5 py-0.5">
							+{card.labels.length - 3}
						</Badge>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Main Content: Scrollable -->
		<div class="flex-1 overflow-y-auto px-6 py-4 space-y-4">
			<!-- Image Section -->
			{#if card.image}
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
			{/if}

			<!-- Full Description (NICHT 2-line clamp wie in Card!) -->
			{#if card.description}
				<div class="space-y-2">
					<h3 class="text-sm font-semibold text-muted-foreground">Beschreibung</h3>
					<div class="p-3 bg-muted/50 rounded-md text-sm border">
						<MarkdownEditor 
							value={card.description}
							disabled={true}
						/>
					</div>
				</div>
			{/if}

			<!-- Links Section -->
			{#if card.links && card.links.length > 0}
				<div class="space-y-2">
					<h3 class="text-sm font-semibold text-muted-foreground">Links</h3>
					<div class="space-y-2">
						{#each card.links as link, index (link.id || `link-${index}`)}
							<a
								href={link.url}
								target="_blank"
								rel="noopener noreferrer"
								class="flex items-center gap-2 p-2 bg-muted/50 rounded-md hover:bg-muted transition-colors border text-sm"
							>
								<svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
								</svg>
								<div class="flex-1 min-w-0">
									<div class="font-medium truncate">{link.title}</div>
									<div class="text-xs text-muted-foreground truncate">{link.url}</div>
								</div>
							</a>
						{/each}
					</div>
				</div>
			{/if}

			<!-- Attendees / AvatarStack - mit Popover auf Avatar Click -->
			{#if attendees.length > 0}
				<div class="space-y-2">
					<h3 class="text-sm font-semibold text-muted-foreground">Teilnehmer</h3>
					<div class="flex items-center gap-3">
						<!-- Clickable Avatars mit Popover -->
						<div class="flex -space-x-3">
							{#each attendees.slice(0, 5) as author, index}
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
									
									<!-- Action Buttons: Retry (if failed) + Delete -->
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

			<!-- Comment Input Form -->
			<div class="space-y-3">
				<Textarea
					placeholder="Schreibe einen Kommentar..."
					bind:value={commentText}
					disabled={isSubmitting}
					class="min-h-20 resize-none"
				/>
				<div class="flex justify-end gap-2">
					<Button
						variant="outline"
						size="sm"
						class="gap-2 bg-secondary"
						onclick={() => (commentText = '')}
						disabled={isSubmitting || !commentText.trim()}
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
		</div>

		<!-- Footer: Edit Button (statt Schließen, da Dialog selbst Close hat) -->
		<div class="px-6 py-4 border-t bg-muted/20 flex gap-2">
			<Button 
				variant="outline" 
				size="sm"
				class="gap-2 bg-primary"
				onclick={(e) => { e.preventDefault(); e.stopPropagation(); handleEditClick(); }}
			>
				<EditIcon class="h-4 w-4" />
				<span>Bearbeiten</span>
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
