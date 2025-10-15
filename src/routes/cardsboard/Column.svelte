<script lang="ts">
	import { flip } from 'svelte/animate';
   import { dndzone } from 'svelte-dnd-action';
 	import Card from "./Card.svelte";
 	import * as CardUI from "../../lib/components/ui/card/index.js";
	import * as Popover from "$lib/components/ui/popover/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import * as RadioGroup from "$lib/components/ui/radio-group/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
 	import type { CardItem, ColumnDropHandler, PublishState } from "./types.js";

 	const flipDurationMs = 150;

 	// Suppress passive event listener warnings for dnd-action
 	// This is a known issue with svelte-dnd-action library
 	if (typeof window !== 'undefined') {
 			// Override console.warn to suppress the specific passive listener warning
 			const originalWarn = console.warn;
 			console.warn = function(...args) {
 				const message = String(args[0] || '');
 				if (message.includes('non-passive event listener') ||
 					message.includes('Added non-passive event listener') ||
 					message.includes('scroll-blocking') ||
 					message.includes('touchstart') ||
 					message.includes('touchmove')) {
 					return; // Suppress these specific warnings
 				}
 				originalWarn.apply(console, args);
 			};
 		}

	let {
		name,
		items,
		color,
		columnId,
		isSelected = false,
		onSelect,
		onDrop,
		onCardAction,
		onPublishStateChange,
		onSidebarAction,
		selectedCardId,
		onSelectCard
	}: {
		name: string;
		items: CardItem[];
		color?: string;
		columnId?: string;
		isSelected?: boolean;
		onSelect?: () => void;
		onDrop: ColumnDropHandler;
		onCardAction?: (cardId: string, action: string) => void;
		onPublishStateChange?: (cardId: string, newState: PublishState) => void;
		onSidebarAction?: (cardId: string, action: string) => void;
		selectedCardId?: string | null;
		onSelectCard?: (cardId: string) => void;
	} = $props();

	// Local state for column editing
	let isEditing = $state(false);
	let editName = $state(name);
	let selectedColor = $state(color || 'slate');
	let popoverOpen = $state(false);

	const colorOptions = [
		{ value: 'slate', label: 'Slate' },
		{ value: 'red', label: 'Rot' },
		{ value: 'orange', label: 'Orange' },
		{ value: 'yellow', label: 'Gelb' },
		{ value: 'green', label: 'Grün' },
		{ value: 'blue', label: 'Blau' },
		{ value: 'purple', label: 'Lila' }
	];

 	function handleDndConsiderCards(e: any) {
 		const { items: newItems } = e.detail;
  	   console.warn("got consider", name);
 		items = newItems;
   }
   function handleDndFinalizeCards(e: any) {
     onDrop(e.detail.items);
   }

   function handleCardAction(event: CustomEvent) {
   		const { cardId, action } = event.detail;
   		onCardAction?.(cardId, action);
   }

   function handlePublishStateChange(event: CustomEvent) {
   		const { cardId, newState } = event.detail;
   		onPublishStateChange?.(cardId, newState);
   }

   function handleSidebarAction(event: CustomEvent) {
   		const { cardId, action } = event.detail;
   		onSidebarAction?.(cardId, action);
   }

   function getCardColor(colorName: string | undefined): string {
   		return colorName ? `var(--${colorName})` : 'var(--muted)';
   }

	function handleRename() {
		name = editName;
		popoverOpen = false;
	}

	function handleColorChange() {
		color = selectedColor;
		popoverOpen = false;
	}

	function handleDelete() {
		if (confirm(`Spalte "${name}" wirklich löschen?`)) {
			// TODO: Implement delete column
			console.log('Delete column:', name);
		}
		popoverOpen = false;
	}
</script>

<style>
	.column-wrapper {
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
	}

	.column-header {
		display: flex;
		flex-direction: column;
		padding-bottom: 0.75rem;
	}

	.column-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin-bottom: 0.5rem;
	}

	.color-bar {
		height: 4px;
		width: 100%;
		border-radius: 2px;
	}

	.column-content {
		flex: 1;
		overflow-y: auto;
		padding-right: 0.5rem;
	}

	.card-wrapper {
		margin-bottom: 0.75rem;
	}

	.card-wrapper:last-child {
		margin-bottom: 0;
	}

	/* Scrollbar styling */
	.column-content::-webkit-scrollbar {
		width: 6px;
	}

	.column-content::-webkit-scrollbar-track {
		background: hsl(var(--muted));
		border-radius: 3px;
	}

	.column-content::-webkit-scrollbar-thumb {
		background: hsl(var(--muted-foreground) / 0.3);
		border-radius: 3px;
	}

	.column-content::-webkit-scrollbar-thumb:hover {
		background: hsl(var(--muted-foreground) / 0.5);
	}
</style>

<div 
	class="column-wrapper {isSelected ? 'border-2 border-primary rounded-lg' : ''}" 
	onclick={onSelect}
	onkeydown={(e) => e.key === 'Enter' && onSelect?.()}
	role="button"
	tabindex="0"
>
	<div class="column-header">
		<div class="flex items-center justify-between w-full">
			<div class="column-title">{name}</div>
			<!-- Spalten-Aktionen Popover -->
			<Popover.Root bind:open={popoverOpen}>
				<Popover.Trigger>
					<Button variant="ghost" size="icon" class="h-6 w-6">
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="5" r="1"/>
							<circle cx="12" cy="12" r="1"/>
							<circle cx="12" cy="19" r="1"/>
						</svg>
					</Button>
				</Popover.Trigger>
				<Popover.Content align="end" class="w-64">
					<div class="space-y-4">
						<div class="space-y-2">
							<h4 class="font-medium text-sm">Spalte umbenennen</h4>
							<Input bind:value={editName} placeholder="Spaltenname" />
							<Button size="sm" onclick={handleRename} class="w-full">
								Umbenennen
							</Button>
						</div>
						
						<Separator />
						
						<div class="space-y-2">
							<h4 class="font-medium text-sm">Farbe wählen</h4>
							<RadioGroup.Root bind:value={selectedColor}>
								{#each colorOptions as option}
									<div class="flex items-center space-x-2">
										<RadioGroup.Item value={option.value} id={`color-${option.value}`} />
										<Label for={`color-${option.value}`}>{option.label}</Label>
									</div>
								{/each}
							</RadioGroup.Root>
							<Button size="sm" onclick={handleColorChange} class="w-full">
								Farbe ändern
							</Button>
						</div>
						
						<Separator />
						
						<Button variant="destructive" size="sm" onclick={handleDelete} class="w-full">
							Spalte löschen
						</Button>
					</div>
				</Popover.Content>
			</Popover.Root>
		</div>
		<div class="color-bar" style="background-color: {getCardColor(color)}"></div>
	</div>

	<div class="column-content" use:dndzone={{items, flipDurationMs}}
	     onconsider={handleDndConsiderCards}
		 onfinalize={handleDndFinalizeCards}>
		{#each items as item (item.id)}
			<div animate:flip="{{duration: flipDurationMs}}" class="card-wrapper">
				<Card
					card={item}
					isSelected={selectedCardId === String(item.id)}
					onSelect={() => onSelectCard?.(String(item.id))}
					{onCardAction}
					{onPublishStateChange}
					{onSidebarAction}
				/>
			</div>
		{/each}
   </div>
</div>