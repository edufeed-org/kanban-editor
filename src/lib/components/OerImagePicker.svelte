<script lang="ts">
	import type {
		OerSearchResultEvent,
		OerSearchElement,
		OerListElement,
		PaginationElement,
        OerCardClickEvent
	} from '@edufeed-org/oer-finder-plugin';
	import { onMount } from 'svelte';
	import { settingsStore } from '$lib/stores/settingsStore.svelte';

	interface Props {
		onSelect: (imageUrl: string) => void;
	}

	const apiUrl = $state(settingsStore.settings.apiUrl)
	const language = $state(settingsStore.settings.language)
	const { onSelect }: Props = $props();

	const availableSources = [
		{ value: 'openverse', label: 'Openverse' },
		{ value: 'arasaac', label: 'ARASAAC' },
		{ value: 'nostr', label: 'Nostr' }
	];

	let searchEl: OerSearchElement;
	let listEl: OerListElement;
	let paginationEl: PaginationElement;

	onMount(async () => {
		// Dynamically import the plugin only on the client side to avoid SSR issues
		await import('@edufeed-org/oer-finder-plugin');
		
		// Handle search results
		searchEl?.addEventListener('search-results', (e: Event) => {
			const customEvent = e as CustomEvent<OerSearchResultEvent>;
			listEl.oers = customEvent.detail.data;
			listEl.loading = false;
			paginationEl.metadata = customEvent.detail.meta;
		});

		searchEl?.addEventListener('search-error', (e: Event) => {
			const customEvent = e as CustomEvent<{ error: string }>;
			listEl.oers = [];
			listEl.error = customEvent.detail.error;
		});

		// Handle card selection - extract image URL from new schema structure
		listEl?.addEventListener('card-click', (e: Event) => {
			const customEvent = e as CustomEvent<OerCardClickEvent>;
			const oer = customEvent.detail.oer;
			const imageUrl = oer.extensions?.images?.high || oer.extensions?.images?.medium || oer.extensions?.images?.small || oer.amb?.id;
			if (imageUrl) {
				onSelect(imageUrl);
			}
		});

		// Handle pagination
		paginationEl?.addEventListener('page-change', (e: Event) => {
			const customEvent = e as CustomEvent;
			searchEl.dispatchEvent(new CustomEvent('page-change', { detail: customEvent.detail }));
		});
	});
</script>

<div class="oer-picker-container">
	<oer-search
		bind:this={searchEl}
		api-url={apiUrl}
		language={language}
		locked-type="image"
		show-type-filter={false}
		show-source-filter={true}
		available-sources={JSON.stringify(availableSources)}
		page-size={12}
	>
		<oer-list bind:this={listEl} {language}></oer-list>
		<oer-pagination bind:this={paginationEl} {language}></oer-pagination>
	</oer-search>
</div>

<style>
	.oer-picker-container {
		--primary-color: var(--accent);
		--primary-hover-color: color-mix(in oklch, var(--accent) 85%, black);
		--secondary-color: var(--secondary);
		--background-card: var(--card);
		--background-form: var(--background);
	    --background-input: var(--background);
		--text-primary: var(--foreground);
		--text-secondary: var(--foreground);
		--text-muted: var(--muted-foreground);
		--border-color: var(--border);
		--input-border-color: var(--border);
	}
</style>
