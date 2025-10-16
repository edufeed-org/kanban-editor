<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import type { CardItem } from './types.js';

	interface Props {
		card: CardItem;
		isOpen: boolean;
		onClose: () => void;
	}

	const { card, isOpen, onClose }: Props = $props();

	let activeTab = $state('content');

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
	<Dialog.Content class="w-full max-w-2xl max-h-96 overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>{card.name}</Dialog.Title>
		</Dialog.Header>

		<Tabs.Root bind:value={activeTab}>
			<Tabs.List class="grid w-full grid-cols-2">
				<Tabs.Trigger value="content">Inhalt</Tabs.Trigger>
				<Tabs.Trigger value="comments">Kommentare</Tabs.Trigger>
			</Tabs.List>

			<!-- Content Tab -->
			<Tabs.Content value="content" class="space-y-4">
				{#if card.description}
					<div class="space-y-2">
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
			<Tabs.Content value="comments" class="space-y-4">
				{#if (card.comments || []).length > 0}
					<div class="space-y-3">
						{#each card.comments as comment (comment.id)}
							<div class="p-3 bg-muted rounded-md space-y-1">
								<div class="flex justify-between items-center">
									<span class="font-medium text-sm">{comment.author}</span>
									<span class="text-xs text-muted-foreground">
										{new Date(comment.createdAt).toLocaleDateString('de-DE')}
									</span>
								</div>
								<p class="text-sm text-foreground">{comment.text}</p>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-muted-foreground text-center py-8">Keine Kommentare vorhanden</p>
				{/if}
			</Tabs.Content>
		</Tabs.Root>

		<Dialog.Footer>
			<Button variant="outline" onclick={onClose}>Schließen</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<style>
	:global([data-state='inactive']) {
		display: none;
	}
</style>
