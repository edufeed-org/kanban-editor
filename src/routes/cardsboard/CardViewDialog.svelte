<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
	import { authStore } from '$lib/stores/authStore.svelte.js';
	import SendIcon from '@lucide/svelte/icons/send';
	import LoaderIcon from '@lucide/svelte/icons/loader';
	import TrashIcon from '@lucide/svelte/icons/trash';
	import type { CardItem } from './types.js';

	interface Props {
		cardId: string | number;
		isOpen: boolean;
		onClose: () => void;
	}

	const { cardId, isOpen, onClose }: Props = $props();

	let activeTab = $state('content');
	let commentText = $state('');
	let isSubmitting = $state(false);

	/**
	 * 🔥 KRITISCH: Lese die Karte DIREKT aus boardStore.uiData
	 * Das stellt sicher, dass Änderungen (z.B. neue Kommentare) sofort sichtbar sind!
	 * NICHT: vom card-Prop abhängen (wird von Parent nie aktualisiert)
	 */
	let currentCard = $derived.by(() => {
		for (const col of boardStore.uiData) {
			const found = col.items.find(c => String(c.id) === String(cardId));
			if (found) return found;
		}
		return null;
	});

	// Abgeleitete Werte - werden automatisch aktualisiert wenn currentCard ändert
	let displayComments = $derived(currentCard?.comments || []);
	let card = $derived(currentCard || { 
		id: cardId,
		name: 'Unbekannte Karte', 
		description: '',
		comments: [],
		attendees: [],
		labels: [],
		color: 'slate',
		publishState: 'draft' as const
	});

	/**
	 * Handles comment submission
	 * Phase A (UI-Formular Implementation)
	 */
	async function handleAddComment() {
		if (!commentText.trim()) return;

		try {
			isSubmitting = true;
			console.log('🔍 handleAddComment aufgerufen');
			console.log('📍 card.id:', card.id);
			console.log('📝 commentText:', commentText);
			console.log('🏪 boardStore vorhanden:', !!boardStore);
			
			// ✅ FIXED: Nutze authStore.getUserName() für schönere Anzeige!
			// Fallback auf pubkey wenn kein Name vorhanden, final fallback auf 'anonymous'
			const author = authStore.getUserName() || authStore.getPubkey() || 'anonymous';

			console.log('➡️ Rufe boardStore.addComment() auf mit author:', author);
			boardStore.addComment(card.id as string, commentText.trim(), author);

			// UI Update - Kommentar sollte sofort sichtbar sein via $effect
			console.log('✅ Kommentar hinzugefügt und gespeichert');
			commentText = '';
		} catch (error) {
			console.error('❌ Fehler beim Hinzufügen des Kommentars:', error);
		} finally {
			isSubmitting = false;
		}
	}

	/**
	 * Handles comment deletion
	 * Phase A (UI-Formular Implementation)
	 */
	function handleDeleteComment(commentId: string) {
		try {
			boardStore.deleteComment(card.id as string, commentId);
			console.log('✅ Kommentar gelöscht');
		} catch (error) {
			console.error('❌ Fehler beim Löschen des Kommentars:', error);
		}
	}

	// Ensure minimum 1 attendee (author should always be included)
	const attendees = $derived(
		card.attendees && card.attendees.length > 0
			? card.attendees
			: card.author
				? [card.author]
				: []
	);
</script>

<Dialog.Root open={isOpen} onOpenChange={(open) => {
	if (!open) {
		onClose();
	}
}}>
	<Dialog.Content class="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
		<Dialog.Header>
			<Dialog.Title>{card.name}</Dialog.Title>
		</Dialog.Header>

		<div class="w-full">
			<Tabs.Root bind:value={activeTab}>
				<Tabs.List class="bg-muted text-muted-foreground inline-flex h-9 items-center justify-center rounded-lg p-[3px] w-full">
					<Tabs.Trigger value="content">Inhalt</Tabs.Trigger>
					<Tabs.Trigger value="comments">Kommentare ({(displayComments || []).length})</Tabs.Trigger>
				</Tabs.List>			<!-- Content Tab -->
		<Tabs.Content value="content" class="space-y-4 w-full">
			{#if card.image}
				<div class="space-y-2 w-full">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="text-sm font-medium">Kartenbild</label>
					<div class="rounded-md overflow-hidden max-h-64 bg-muted">
						<img
							src={card.image}
							alt="Kartenbild"
							class="w-full h-full object-cover"
							onerror={(e) => {
								(e.target as HTMLImageElement).style.display = 'none';
							}}
						/>
					</div>
				</div>
			{/if}

			{#if card.description}
				<div class="space-y-2 w-full">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="text-sm font-medium">Beschreibung</label>
					<div class="p-3 bg-muted rounded-md text-sm break-words whitespace-pre-wrap">
						{card.description}
					</div>
				</div>
			{/if}

				{#if card.labels && card.labels.length > 0}
					<div class="space-y-2">
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="text-sm font-medium">Labels</label>
						<div class="flex flex-wrap gap-2">
							{#each card.labels as label (label)}
								<Badge variant="outline">{label}</Badge>
							{/each}
						</div>
					</div>
				{/if}

				{#if card.link}
					<div class="space-y-2">
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="text-sm font-medium">Link</label>
						<Button
							variant="outline"
							class="w-full justify-start text-left"
							onclick={() => window.open(card.link, '_blank', 'noopener,noreferrer')}
						>
							<span class="icon-[material-symbols--link] mr-2"></span>
							{card.link}
						</Button>
					</div>
				{/if}

				{#if attendees.length > 0}
					<div class="space-y-2">
						<!-- svelte-ignore a11y_label_has_associated_control -->
						<label class="text-sm font-medium">Teilnehmer ({attendees.length})</label>
						<div class="flex flex-wrap gap-2">
							{#each attendees as attendee (attendee)}
								<Badge variant="secondary">{attendee}</Badge>
							{/each}
						</div>
					</div>
				{/if}
			</Tabs.Content>

		<!-- Comments Tab -->
		<Tabs.Content value="comments" class="space-y-4 min-w-full">
			<!-- Existing Comments List -->
			{#if (displayComments || []).length > 0}
				<div class="space-y-3 max-h-40 overflow-y-auto min-w-full">
					{#each displayComments as comment, index (comment.id || `comment-${index}`)}
						<div class="p-3 bg-muted rounded-md space-y-2">
							<div class="flex justify-between items-start gap-2">
								<div class="flex-1">
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
									class="text-destructive hover:bg-destructive/10"
								>
									<TrashIcon class="h-3 w-3" />
								</Button>
							</div>
							<p class="text-sm text-foreground whitespace-pre-wrap break-words">{comment.text}</p>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-muted-foreground text-center py-4">Keine Kommentare vorhanden</p>
			{/if}

			<!-- Comment Input Form (Phase A: UI-Formular) -->
			<div class="pt-4 border-t space-y-3">
				<label for="comment-textarea" class="text-sm font-medium">Neuer Kommentar</label>
				<Textarea
					id="comment-textarea"
					placeholder="Schreibe einen Kommentar..."
					bind:value={commentText}
					disabled={isSubmitting}
					class="min-h-24 resize-none"
				/>
				<div class="flex justify-end gap-2">
					<Button
						variant="outline"
						onclick={() => (commentText = '')}
						disabled={isSubmitting || !commentText.trim()}
					>
						Abbrechen
					</Button>
					<Button
						variant="outline"
						onclick={handleAddComment}
						disabled={isSubmitting || !commentText.trim()}
						class="group"
					>
						{#if isSubmitting}
							<LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
							Wird gesendet...
						{:else}
							<SendIcon class="mr-2 h-4 w-4" />
							Kommentar absenden
						{/if}
					</Button>
				</div>
			</div>
		</Tabs.Content>
		</Tabs.Root>
		</div>

		<Dialog.Footer>
			<Button variant="outline" onclick={onClose}>Schließen</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	/* Nur Tabs.Content (nicht Tabs.Trigger!) sollen bei inaktiv versteckt werden */
	/* :global([role='tabpanel'][data-state='inactive']) {
		display: none;
	} */
</style>
