<script lang="ts">
import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as RadioGroup from '$lib/components/ui/radio-group/index.js';
	import SettingsIcon from '@lucide/svelte/icons/settings';
	import * as Popover from '$lib/components/ui/popover/index.js';

	let popoverOpen = $state(false);

	// Direkt auf settingsStore.settings zugreifen (Svelte 5 Runes)
	let settings = $derived(settingsStore.settings);

	function handleMaxCardsChange(e: Event) {
		const value = parseInt((e.target as HTMLInputElement).value);
		if (!isNaN(value)) {
			settingsStore.setMaxCardsBeforeScroll(value);
		}
	}

	function handleAlignColumnsChange(value: string) {
		settingsStore.setAlignColumnsToMaxHeight(value === 'true');
	}

	function handleReset() {
		if (confirm('Alle Einstellungen auf Standard zurücksetzen?')) {
			settingsStore.reset();
		}
	}
</script>

<style>
	/* All styling done via Tailwind classes directly on elements */
</style>

<!-- Settings Icon Button -->
<Popover.Root bind:open={popoverOpen}>
	<Popover.Trigger>
		<button class="inline-flex items-center justify-center h-9 w-9 p-2 rounded-md group hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50" title="Einstellungen">
			<SettingsIcon class="h-4 w-4" />
		</button>
	</Popover.Trigger>

	<Popover.Content align="end" class="w-80">
		<div class="space-y-4">
			<div>
				<h4 class="font-semibold text-sm">Kanban-Einstellungen</h4>
				<p class="text-xs text-muted-foreground mt-1">Konfiguriere das Layout und Verhalten des Boards</p>
			</div>

			<!-- Setting 1: Max Cards Before Scroll -->
			<div class="space-y-2">
				<label for="max-cards-input" class="text-sm font-medium">
					Max. Karten pro Spalte (bevor gescrollt wird)
				</label>
				<div class="flex gap-2 items-center">
					<Input
						id="max-cards-input"
						type="number"
						min="5"
						max="100"
						value={settings?.maxCardsBeforeScroll ?? 20}
						onchange={handleMaxCardsChange}
						placeholder="z.B. 20"
						class="flex-1"
					/>
					<div class="text-xs text-muted-foreground min-w-max">Karten</div>
				</div>
				<p class="text-xs text-muted-foreground">
					Hat eine Spalte mehr Karten, wird ein interner Scrollbalken aktiviert.
				</p>
			</div>

			<!-- Setting 2: Align Columns to Max Height -->
			<div class="space-y-2">
				<div class="text-sm font-medium">Spalten auf gleiche Höhe ausrichten</div>
				<RadioGroup.Root
					value={settings?.alignColumnsToMaxHeight ? 'true' : 'false'}
					onValueChange={handleAlignColumnsChange}
				>
					<div class="flex items-center space-x-2 mb-2">
						<RadioGroup.Item value="true" id="align-true" />
						<label for="align-true" class="text-sm cursor-pointer">Ja, alle auf maximale Höhe ausrichten</label>
					</div>
					<div class="flex items-center space-x-2">
						<RadioGroup.Item value="false" id="align-false" />
						<label for="align-false" class="text-sm cursor-pointer">Nein, jede Spalte hat ihre eigene Höhe</label>
					</div>
				</RadioGroup.Root>
				<p class="text-xs text-muted-foreground">
					Wenn aktiviert, wachsen alle Spalten auf die Höhe der längsten Spalte.
				</p>
			</div>

			<!-- Reset Button -->
			<div class="pt-2 border-t">
				<Button
					variant="outline"
					size="sm"
					onclick={handleReset}
					class="w-full"
				>
					Auf Standard zurücksetzen
				</Button>
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
