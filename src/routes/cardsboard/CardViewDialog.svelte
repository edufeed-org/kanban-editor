<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
	import { authStore } from '$lib/stores/authStore.svelte.js';
	import AvatarStack from './AvatarStack.svelte';
	import SendIcon from '@lucide/svelte/icons/send';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import EditIcon from '@lucide/svelte/icons/edit';
	import MoreVerticalIcon from '@lucide/svelte/icons/more-vertical';
	import type { CardItem } from './types.js';

	interface Props {
		cardId: string | number;
		open: boolean;
	}

	let { cardId, open = $bindable() }: Props = $props();

	let commentText = $state('');
	let isSubmitting = $state(false);

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

	const attendees = $derived(
		card.attendees && card.attendees.length > 0
			? card.attendees
			: card.author
				? [card.author]
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
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden p-0">
		<!-- Header: Wie Card, aber ohne Edit Button -->
		<div class="px-6 py-4 border-b bg-background">
			<div class="flex items-start justify-between gap-4">
				<div class="flex-1">
					<h2 class="text-xl font-semibold mb-2">{card.name}</h2>

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

				<!-- Author Menu (nur MoreVertical Icon) -->
				<div class="flex items-center gap-2">
					<Popover.Root>
						<Popover.Trigger>
							<Button variant="ghost" size="sm">
								<MoreVerticalIcon class="h-4 w-4" />
							</Button>
						</Popover.Trigger>
						<Popover.Content side="bottom" align="end" class="w-48">
							<div class="space-y-2">
								<div class="text-sm font-semibold px-2 py-1">
									{card.authorName || card.author || 'Ersteller unbekannt'}
								</div>
								{#if card.author && card.authorName !== card.author}
									<div class="text-xs text-muted-foreground px-2 font-mono truncate">
										{card.author}
									</div>
								{/if}
							</div>
						</Popover.Content>
					</Popover.Root>
				</div>
			</div>
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

			<!-- Attendees / AvatarStack -->
			{#if attendees.length > 0}
				<div class="space-y-2">
					<h3 class="text-sm font-semibold text-muted-foreground">Teilnehmer</h3>
					<div class="flex items-center gap-3">
						<AvatarStack {attendees} maxVisible={5} />
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
							<!-- Avatar Links vom Kommentar -->
							<div class="avatar w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white border border-border flex-shrink-0" 
								style="background-color: {getAvatarColor(comment.author)}"
								title={comment.author}>
								{getInitials(comment.author)}
							</div>

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
