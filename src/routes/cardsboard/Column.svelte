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
 	, maxCardsBeforeScroll = 20
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
		maxCardsBeforeScroll?: number;
	} = $props();

	import SquarePlusIcon from '@lucide/svelte/icons/square-plus';

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

	function handleHeaderClick(e: MouseEvent) {
		// Only select column when clicking on the header itself, not on the popover trigger
		if ((e.target as HTMLElement).closest('.popover-trigger-ignore')) {
			return;
		}
		e.stopPropagation();
		onSelect?.();
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
		cursor: pointer;
		transition: opacity 0.2s ease;
	}

	.column-header:hover {
		opacity: 0.8;
	}

	.column-header:focus {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
		border-radius: 4px;
	}

	.column-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--foreground);
		margin-bottom: 0.5rem;
	}

	.color-bar {
		height: 1px;
		width: 100%;
		border-radius: 2px;
	}

	.column-content {
		flex: 0 0 auto; /* do not scroll individually - let column grow */
		padding-right: 0.5rem;
	}

	/* When many cards are present we allow the column to use an inner scroll */
	.column-content.scrollable {
		flex: 1 1 auto;
		overflow-y: auto;
		max-height: 70vh; /* reasonable cap so footer remains reachable */
	}

	.column-footer {
		flex: 0 0 auto;
		padding: 0.5rem;
		border-top: 1px dashed var(--muted);
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 48px;
		cursor: pointer;
		background: linear-gradient(180deg, transparent, rgba(0,0,0,0.01));
	}

	/* Hover style handled via pointer events on the element (no separate .hover selector to satisfy Svelte) */

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
		background: var(--muted);
		border-radius: 3px;
	}

	.column-content::-webkit-scrollbar-thumb {
		background: var(--muted-foreground);
		opacity: 0.3;
		border-radius: 3px;
	}

	.column-content::-webkit-scrollbar-thumb:hover {
		opacity: 0.5;
	}
</style>

<div 
	class="column-wrapper {isSelected ? 'border-2 border-primary rounded-lg' : ''}" 
>
		<div class="column-header" onclick={handleHeaderClick} onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				handleHeaderClick(e as unknown as MouseEvent);
			}
		}} role="button" tabindex="0">
			<div class="flex items-center justify-between w-full">
				<div class="column-title">{name}</div>
				<!-- Spalten-Aktionen Popover -->
				<Popover.Root bind:open={popoverOpen}>
					<Popover.Trigger class="popover-trigger-ignore inline-flex items-center justify-center h-6 w-6 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 rounded-md transition-all">
						<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="5" r="1"/>
							<circle cx="12" cy="12" r="1"/>
							<circle cx="12" cy="19" r="1"/>
						</svg>
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

	<div class={`column-content ${items.length > (maxCardsBeforeScroll || 20) ? 'scrollable' : ''}`} use:dndzone={{items, flipDurationMs, dropTargetStyle: {outline: '1px solid var(--accent)', 'outline-offset': '-2px'}}}
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

	<!-- Footer: show drop icon and allow click to append a placeholder card -->
	<button type="button" class="column-footer" onclick={() => {
			const newCard: CardItem = {
				id: Date.now(),
				name: 'Neue Karte (Platzhalter) - bitte bearbeiten',
				description: 'Platzhalterkarte erstellt durch Footer-Button',
			};
			items = [...items, newCard];
			onDrop(items);
		}}>
		<SquarePlusIcon class="h-5 w-5" />
		<span class="sr-only">Karte ans Ende anfügen</span>
	</button>
</div>