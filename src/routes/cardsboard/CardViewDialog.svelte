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
	import SendIcon from '@lucide/svelte/icons/send';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import EditIcon from '@lucide/svelte/icons/edit';
	import EllipsisVerticalIcon from '@lucide/svelte/icons/ellipsis-vertical';
	import UserIcon from '@lucide/svelte/icons/user';
	import type { CardItem } from './types.js';

	interface Props {
		cardId: string | number;
		open: boolean;
	}

	let { cardId, open = $bindable() }: Props = $props();

	let commentText = $state('');
	let isSubmitting = $state(false);
	let selectedAuthorPopover = $state<string | null>(null);
	let editName = $state('');
	let selectedColor = $state('slate');
	let localPublishState = $state<'draft' | 'published' | 'archived'>('draft');

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
		localPublishState = (card.publishState || 'draft') as 'draft' | 'published' | 'archived';
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
	 */
	async function handleAddComment() {
		if (!commentText.trim()) return;

		try {
			isSubmitting = true;
			const author = authStore.getUserName() || authStore.getPubkey() || 'anonymous';
			boardStore.addComment(card.id as string, commentText.trim(), author);
			commentText = '';
		} catch (error) {
			console.error('❌ Fehler beim Hinzufügen des Kommentars:', error);
		} finally {
			isSubmitting = false;
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
	 * Toggle publish state: draft → published → archived → draft
	 */
	function handlePublishToggle() {
		const states: ('draft' | 'published' | 'archived')[] = ['draft', 'published', 'archived'];
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
						<Popover.Trigger class="h-8 w-8 p-0 hover:bg-accent rounded flex items-center justify-center">
							<EllipsisVerticalIcon class="h-4 w-4" />
						</Popover.Trigger>
					<Popover.Content align="end" side="bottom" class="w-72">
						<div class="space-y-4">
							<!-- Author Info -->
							{#if card.author && card.authorName}
								<div class="space-y-2">
									<h4 class="font-medium text-sm">Erstellt von</h4>
									<div class="flex items-center gap-2 p-2 bg-muted rounded">
										<UserIcon class="h-4 w-4 text-muted-foreground flex-shrink-0" />
										<div class="flex-1 min-w-0">
											<p class="text-sm font-medium truncate">{card.authorName}</p>
											<code class="text-xs text-muted-foreground font-mono">{card.author.slice(0, 8)}…</code>
										</div>
									</div>
								</div>
								<Separator.Root class="my-3" />
							{/if}
							
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
					<div class="p-3 bg-muted/50 rounded-md text-sm whitespace-pre-wrap break-words border">
						{card.description}
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

			<!-- Comments Section Header -->
			<h3 class="text-sm font-semibold text-muted-foreground">
				Kommentare ({displayComments.length})
			</h3>

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
										<div class="text-sm font-semibold px-2 py-1">
											{comment.author}
										</div>
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
										<div class="font-medium text-sm">{comment.author}</div>
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
									<Button
										variant="ghost"
										size="sm"
										onclick={() => handleDeleteComment(comment.id || `fallback-${index}`)}
										class="text-destructive hover:bg-destructive/10 h-6 w-6 p-0"
									>
										<TrashIcon class="h-3 w-3" />
									</Button>
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
						onclick={() => (commentText = '')}
						disabled={isSubmitting || !commentText.trim()}
					>
						Abbrechen
					</Button>
					<Button
						size="sm"
						onclick={handleAddComment}
						disabled={isSubmitting || !commentText.trim()}
						class="gap-2"
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
				class="gap-2"
				onclick={() => console.log('Edit Card:', card.id)}
			>
				<EditIcon class="h-4 w-4" />
				<span>Bearbeiten</span>
			</Button>
		</div>
	</Dialog.Content>
</Dialog.Root>
