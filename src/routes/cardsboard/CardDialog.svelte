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
	import { boardStore } from '$lib/stores/kanbanStore.svelte.js';
	import type { CardProps, PublishState } from '../../lib/classes/BoardModel.js';
  import OerImagePicker from '$lib/components/OerImagePicker.svelte';
	import MarkdownEditor from '$lib/components/ui/markdown-editor/MarkdownEditor.svelte';

	interface Props {
		card: CardProps | null;
		isOpen: boolean;
		onClose: () => void;
		onSave: (cardId: string, updates: Partial<CardProps>) => void;
	}

	const { card, isOpen, onClose, onSave }: Props = $props();

	// 🔥 KRITISCH: Lese die aktuelle Karte DIREKT aus boardStore.uiData
	// Das stellt sicher, dass Änderungen (z.B. image) sofort sichtbar sind!
	let currentCard = $derived.by(() => {
		if (!card?.id) return card;
		
		// Lese updateTrigger als Dependency-Tracking-Trick
		// Jedes Mal wenn triggerUpdate() aufgerufen wird, wird diese $derived neu berechnet
		const trigger = boardStore.updateTrigger;
		// Silent sync - no log spam
		
		for (const col of boardStore.uiData) {
			const found = col.items.find(c => String(c.id) === String(card.id));
			if (found) return found;
		}
		return card;
	});

	// 🆕 Preview-Daten: werden IMMER aktualisiert (nicht von isUserEditing blockiert!)
	// Diese $derived zeigt die GESPEICHERTEN Änderungen, unabhängig vom Formular
	let previewCard = $derived.by(() => {
		// Lese updateTrigger explizit als Dependency
		const trigger = boardStore.updateTrigger;
		// Silent sync - no log spam
		
		// Finde die aktuelle Karte im Store
		for (const col of boardStore.uiData) {
			// Silent search
			const found = col.items.find(c => String(c.id) === String(card?.id));
			if (found) {
				// Silent sync - card found
				return found;
			}
		}
		console.log('  ✗ Card not found in any column, returning currentCard');
		return currentCard;
	});

	// Form-Schema mit Zod
	const cardSchema = z.object({
		heading: z.string().min(1, 'Titel ist erforderlich').max(200, 'Titel ist zu lang'),
		content: z.string().max(5000, 'Beschreibung ist zu lang'),
		image: z.string().url('Ungültige Image-URL').optional().or(z.literal('')),
		labels: z.array(z.string()),
		links: z.array(
			z.object({
				id: z.string(), // ← REQUIRED: Alle Links haben jetzt IDs (generiert beim Laden)
				url: z.string().url('Ungültige URL'),
				title: z.string().min(1, 'Link-Titel erforderlich')
			})
		),
		publishState: z.enum(['draft', 'published'] as const)
	});

	let formData = $state<{
		heading: string;
		content: string;
		image: string;
		labels: string[];
		links: { id: string; url: string; title: string }[];
		publishState: 'draft' | 'published';
	}>({
		heading: '',
		content: '',
		image: '',
		labels: [],
		links: [],
		publishState: 'draft'
	});

	let errors = $state<Record<string, string>>({});
	let isSubmitting = $state(false);
	let activeTab = $state<'content' | 'settings'>('content');
	let isUserEditing = $state(false); // Guard gegen $effect Überschreibung während Editing
	let imageMode = $state<'url' | 'oer'>('url');

	// Neue Label und Link Input
	let newLabel = $state('');
	let newLinkUrl = $state('');
	let newLinkTitle = $state('');

	// Synchronisiere formData wenn Karte sich ändert
	$effect(() => {
		// Nicht zurückschreiben wenn Benutzer gerade editiert!
		if (isUserEditing) return;
		
		if (currentCard) {
			// currentCard kann entweder CardItem (aus uiData) oder CardProps sein
			// CardItem hat: name, description (statt heading, content)
			// CardProps hat: heading, content
			const heading = ('heading' in currentCard) ? currentCard.heading : (currentCard as any).name;
			const content = ('content' in currentCard) ? currentCard.content : (currentCard as any).description;
			const links = ('links' in currentCard) ? currentCard.links : [];
			
			// 🔧 FIX: Bestehende Links ohne ID bekommen eine generierte ID
			const linksWithIds = (links || []).map(link => ({
				...link,
				id: link.id || crypto.randomUUID() // ← Generiere ID falls fehlend
			}));
			
			formData = {
				heading: heading || '',
				content: content || '',
				image: currentCard.image || '',
				labels: [...(currentCard.labels || [])],
				links: linksWithIds,
				publishState: currentCard.publishState || 'draft'
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
			console.error('❌ Validation failed:', result.error.issues);
			result.error.issues.forEach((issue) => {
				const path = String(issue.path[0] || 'general');
				errors[path] = issue.message;
			});
			return false;
		}

		errors = {};
		return true;
	}

	// Wenn Modal öffnet/schließt, setze isUserEditing Flag
	$effect(() => {
		if (isOpen) {
			isUserEditing = true; // ← EDITIEREN: Keine $effect Überschreibung während Modal offen ist
		} else {
			isUserEditing = false; // ← MODAL ZU: Kann wieder $effect Überschreibung zulassen
		}
	});

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
				image: formData.image,
				labels: formData.labels,
				links: formData.links,
				publishState: formData.publishState as PublishState
			});
			
			// 🔥 KRITISCH: Gib der Reaktivität Zeit, sich zu aktualisieren
			// Die onSave ist synchron, aber die $derived.by() und $effect 
			// brauchen einen Microtask um zu feuern
			await new Promise(resolve => setTimeout(resolve, 0));
			
			isUserEditing = false; // ← Erlaube wieder $effect Überschreibung
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

<Dialog.Root open={isOpen} onOpenChange={(open) => {
	if (!open) {
		onClose();
	}
}}>
	<Dialog.Content class="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
		<Dialog.Header>
			<Dialog.Title>{card?.heading || 'Neue Karte'}</Dialog.Title>
			<Dialog.Description>
				Bearbeiten Sie die Details dieser Karte. Klicken Sie auf Speichern, wenn Sie fertig sind.
			</Dialog.Description>
		</Dialog.Header>

		<form onsubmit={handleSubmit} class="w-full">
			<Tabs.Root bind:value={activeTab} class="w-full">
				<Tabs.List class="bg-muted text-muted-foreground h-9 items-center justify-center rounded-lg p-[3px] text-muted-foreground grid w-full grid-cols-2">
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
							<MarkdownEditor 
								value={formData.content || ''}
								onchange={(content) => formData.content = content}
								placeholder="Kartenbeschreibung eingeben..."
								disabled={isSubmitting}
							/>
						</FieldContent>
						{#if errors.content}
							<FieldError errors={[{ message: errors.content }]} />
						{/if}
					</Field>

					<Field>
						<FieldLabel for="image">Kartenbild</FieldLabel>

						<!-- Mode Toggle -->
						<div class="flex gap-1 mb-2">
							<Button
								type="button"
								variant={imageMode === 'url' ? 'default' : 'outline'}
								size="sm"
								onclick={() => (imageMode = 'url')}
								disabled={isSubmitting}
							>
								URL eingeben
							</Button>
							<Button
								type="button"
								variant={imageMode === 'oer' ? 'default' : 'outline'}
								size="sm"
								onclick={() => (imageMode = 'oer')}
								disabled={isSubmitting}
							>
								OER suchen
							</Button>
						</div>

						{#if imageMode === 'url'}
							<FieldContent>
								<Input
									id="image"
									bind:value={formData.image}
									placeholder="https://example.com/image.jpg"
									disabled={isSubmitting}
									aria-invalid={!!errors.image}
								/>
							</FieldContent>
							{#if errors.image}
								<FieldError errors={[{ message: errors.image }]} />
							{/if}
						{:else}
							<OerImagePicker
								onSelect={(url) => {
									formData.image = url;
									imageMode = 'url';
								}}
							/>
						{/if}

						<!-- Image Preview - show unsaved changes when image differs from saved -->
						{#if formData.image && formData.image !== previewCard?.image}
							<!-- Unsaved preview (new selection from OER or URL input) -->
							<div class="mt-2 rounded-md overflow-hidden bg-muted border-2 border-blue-400">
								<img
									src={formData.image}
									alt="Kartenbild-Vorschau"
									class="w-full h-auto max-h-48 object-contain"
									onerror={(e) => {
										(e.target as HTMLImageElement).style.display = 'none';
									}}
								/>
								<div class="text-xs text-muted-foreground p-1 text-center bg-blue-400/20">
									(Vorschau - noch nicht gespeichert)
								</div>
							</div>
						{:else if previewCard?.image}
							<!-- Saved image -->
							<div class="mt-2 rounded-md overflow-hidden bg-muted">
								<img
									src={previewCard.image}
									alt="Kartenbild-Vorschau (gespeichert)"
									class="w-full h-auto max-h-48 object-contain"
									onerror={(e) => {
										(e.target as HTMLImageElement).style.display = 'none';
									}}
								/>
								<div class="text-xs text-muted-foreground p-1 text-center bg-muted/50">
									✓ Gespeichert
								</div>
							</div>
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
									{#each formData.links as link, index (link.id || `link-${index}`)}
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
