<script lang="ts">
	import { z } from 'zod';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import { Field, FieldLabel, FieldContent, FieldError } from '$lib/components/ui/field/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import type { CardProps, PublishState } from '../../lib/classes/BoardModel.js';

	interface Props {
		card: CardProps | null;
		isOpen: boolean;
		onClose: () => void;
		onSave: (cardId: string, updates: Partial<CardProps>) => void;
	}

	const { card, isOpen, onClose, onSave }: Props = $props();

	// Form-Schema mit Zod
	const cardSchema = z.object({
		heading: z.string().min(1, 'Titel ist erforderlich').max(200, 'Titel ist zu lang'),
		content: z.string().max(5000, 'Beschreibung ist zu lang'),
		labels: z.array(z.string()),
		links: z.array(
			z.object({
				id: z.string(),
				url: z.string().url('Ungültige URL'),
				title: z.string().min(1, 'Link-Titel erforderlich')
			})
		),
		publishState: z.enum(['draft', 'published', 'archived'] as const)
	});

	// Form State mit Svelte 5 Runes
	let formData = $state<Partial<CardProps>>({
		heading: '',
		content: '',
		labels: [],
		links: [],
		publishState: 'draft'
	});

	let errors = $state<Record<string, string>>({});
	let isSubmitting = $state(false);
	let activeTab = $state<'content' | 'settings'>('content');

	// Neue Label und Link Input
	let newLabel = $state('');
	let newLinkUrl = $state('');
	let newLinkTitle = $state('');

	// Synchronisiere formData wenn Karte sich ändert
	$effect(() => {
		if (card) {
			formData = {
				heading: card.heading || '',
				content: card.content || '',
				labels: [...(card.labels || [])],
				links: [...(card.links || [])],
				publishState: card.publishState || 'draft'
			};
			errors = {};
			newLabel = '';
			newLinkUrl = '';
			newLinkTitle = '';
		}
	});

	function validateForm(): boolean {
		const result = cardSchema.safeParse(formData);

		if (!result.success) {
			errors = {};
			result.error.issues.forEach((issue) => {
				const path = String(issue.path[0] || 'general');
				errors[path] = issue.message;
			});
			return false;
		}

		errors = {};
		return true;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();

		if (!validateForm() || !card?.id) {
			return;
		}

		isSubmitting = true;

		try {
			onSave(card.id, {
				heading: formData.heading,
				content: formData.content,
				labels: formData.labels,
				links: formData.links,
				publishState: formData.publishState as PublishState
			});
			onClose();
		} finally {
			isSubmitting = false;
		}
	}

	function addLabel() {
		if (newLabel.trim() && !(formData.labels || []).includes(newLabel.trim())) {
			formData.labels = [...(formData.labels || []), newLabel.trim()];
			newLabel = '';
		}
	}

	function removeLabel(label: string) {
		formData.labels = (formData.labels || []).filter((l) => l !== label);
	}

	function addLink() {
		if (newLinkUrl.trim() && newLinkTitle.trim()) {
			const newLink = {
				id: crypto.randomUUID(),
				url: newLinkUrl.trim(),
				title: newLinkTitle.trim()
			};
			formData.links = [...(formData.links || []), newLink];
			newLinkUrl = '';
			newLinkTitle = '';
		}
	}

	function removeLink(linkId: string) {
		formData.links = (formData.links || []).filter((l) => l.id !== linkId);
	}
</script>

<Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
	<Dialog.Content class="sm:max-w-[600px]">
		<Dialog.Header>
			<Dialog.Title>{card?.heading || 'Neue Karte'}</Dialog.Title>
			<Dialog.Description>
				Bearbeiten Sie die Details dieser Karte. Klicken Sie auf Speichern, wenn Sie fertig sind.
			</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleSubmit} class="w-full">
			<Tabs.Root bind:value={activeTab} class="w-full">
				<Tabs.List class="grid w-full grid-cols-2">
					<Tabs.Trigger value="content">Inhalt</Tabs.Trigger>
					<Tabs.Trigger value="settings">Einstellungen</Tabs.Trigger>
				</Tabs.List>

				<!-- Content Tab -->
				<Tabs.Content value="content" class="space-y-4 py-4">
					<Field>
						<FieldLabel for="title">Titel <span class="text-destructive">*</span></FieldLabel>
						<FieldContent>
							<Input
								id="title"
								bind:value={formData.heading}
								placeholder="Kartentitel eingeben"
								disabled={isSubmitting}
								aria-invalid={!!errors.heading}
							/>
						</FieldContent>
						{#if errors.heading}
							<FieldError errors={[{ message: errors.heading }]} />
						{/if}
					</Field>

					<Field>
						<FieldLabel for="description">Beschreibung</FieldLabel>
						<FieldContent>
							<Textarea
								id="description"
								bind:value={formData.content}
								placeholder="Kartenbeschreibung eingeben"
								class="min-h-[100px]"
								disabled={isSubmitting}
							/>
						</FieldContent>
						{#if errors.content}
							<FieldError errors={[{ message: errors.content }]} />
						{/if}
					</Field>

					<!-- Links Section -->
					<Field>
						<FieldLabel>Links</FieldLabel>
						<FieldContent class="space-y-3">
							<!-- Link Input -->
							<div class="flex gap-2">
								<Input
									placeholder="Link-Titel"
									bind:value={newLinkTitle}
									disabled={isSubmitting}
									class="flex-1"
								/>
								<Input
									placeholder="https://..."
									bind:value={newLinkUrl}
									disabled={isSubmitting}
									class="flex-1"
								/>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									onclick={addLink}
									disabled={isSubmitting || !newLinkTitle.trim() || !newLinkUrl.trim()}
								>
									Hinzufügen
								</Button>
							</div>

							<!-- Links List -->
							{#if formData.links && formData.links.length > 0}
								<div class="space-y-2">
									{#each formData.links as link (link.id)}
										<div
											class="flex items-center justify-between rounded border border-border bg-background p-2"
										>
											<div>
												<p class="font-medium text-primary">{link.title}</p>
												<p class="text-xs text-muted-foreground">{link.url}</p>
											</div>
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onclick={() => removeLink(link.id)}
												disabled={isSubmitting}
											>
												✕
											</Button>
										</div>
									{/each}
								</div>
							{/if}
						</FieldContent>
					</Field>
				</Tabs.Content>

				<!-- Settings Tab -->
				<Tabs.Content value="settings" class="space-y-4 py-4">
					<!-- Labels Section -->
					<Field>
						<FieldLabel>Labels</FieldLabel>
						<FieldContent class="space-y-3">
							<!-- Label Input -->
							<div class="flex gap-2">
								<Input
									placeholder="Label eingeben"
									bind:value={newLabel}
									disabled={isSubmitting}
									class="flex-1"
								/>
								<Button
									type="button"
									variant="secondary"
									size="sm"
									onclick={addLabel}
									disabled={isSubmitting || !newLabel.trim()}
								>
									Hinzufügen
								</Button>
							</div>

							<!-- Labels List -->
							{#if formData.labels && formData.labels.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each formData.labels as label (label)}
										<Badge variant="secondary" class="cursor-pointer">
											{label}
											<button
												type="button"
												onclick={() => removeLabel(label)}
												disabled={isSubmitting}
												class="ml-1 hover:text-destructive"
											>
												✕
											</button>
										</Badge>
									{/each}
								</div>
							{/if}
						</FieldContent>
					</Field>

					<Separator />

					<!-- Publish State -->
					<Field>
						<FieldLabel>Veröffentlichungsstatus</FieldLabel>
						<FieldContent class="space-y-2">
							<label class="flex items-center gap-2">
								<input
									type="radio"
									bind:group={formData.publishState}
									value="draft"
									disabled={isSubmitting}
								/>
								<span>Entwurf</span>
							</label>
							<label class="flex items-center gap-2">
								<input
									type="radio"
									bind:group={formData.publishState}
									value="published"
									disabled={isSubmitting}
								/>
								<span>Veröffentlicht</span>
							</label>
							<label class="flex items-center gap-2">
								<input
									type="radio"
									bind:group={formData.publishState}
									value="archived"
									disabled={isSubmitting}
								/>
								<span>Archiviert</span>
							</label>
						</FieldContent>
					</Field>
				</Tabs.Content>
			</Tabs.Root>			<Dialog.Footer class="mt-6">
				<Button type="button" variant="outline" onclick={onClose} disabled={isSubmitting}>
					Abbrechen
				</Button>
				<Button type="submit" disabled={isSubmitting}>
					{isSubmitting ? 'Wird gespeichert...' : 'Speichern'}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
