<script lang="ts">
	import type {
		OerSearchResultEvent,
		OerSearchElement,
		OerListElement,
        OerCardClickEvent,
        SourceConfig,
        LoadMoreElement
	} from '@edufeed-org/oer-finder-plugin';
	import { onMount } from 'svelte';
	import { settingsStore } from '$lib/stores/settingsStore.svelte';

	interface Props {
		onSelect: (imageUrl: string) => void;
	}

	// Currently not used, as client side fetching is activated
	const _apiUrl = $state(settingsStore.settings.apiUrl)
	const language = $state(settingsStore.settings.language)
	const { onSelect }: Props = $props();

	const availableSources: SourceConfig[] = [
		{ id: 'arasaac', label: 'ARASAAC' },
		{ id: 'openverse', label: 'Openverse', checked: true },
		{ id: 'wikimedia', label: 'Wikimedia', checked: true },
		{ id: 'nostr-amb-relay', label: 'Nostr AMB', checked: true, baseUrl: 'wss://amb-relay.edufeed.org' },
		{ id: 'rpi-virtuell', label: 'RPI Virtuell' },
	];

	let searchEl: OerSearchElement;
	let listEl: OerListElement;
	let loadMoreElement: LoadMoreElement;

	onMount(async () => {
		// Dynamically import the plugin only on the client side to avoid SSR issues
		await import('@edufeed-org/oer-finder-plugin');

		// Set sources as a JS property (not HTML attribute)
		searchEl.sources = availableSources;

		searchEl?.addEventListener('search-loading', () => {
			listEl.loading = true;
			loadMoreElement.loading = true;
		});
		
		// Handle search results
		searchEl?.addEventListener('search-results', (e: Event) => {
			const customEvent = e as CustomEvent<OerSearchResultEvent>;
			listEl.oers = customEvent.detail.data;
			listEl.loading = false;
			loadMoreElement.metadata = customEvent.detail.meta;
    		loadMoreElement.loading = false;
		});

		searchEl?.addEventListener('search-error', (e: Event) => {
			const customEvent = e as CustomEvent<{ error: string }>;
			listEl.oers = [];
			listEl.error = customEvent.detail.error;
			loadMoreElement.metadata = null;
    		loadMoreElement.loading = false;
		});

		searchEl?.addEventListener('search-cleared', () => {
			listEl.oers = [];
			listEl.loading = false;
			listEl.error = null;
			loadMoreElement.metadata = null;
			loadMoreElement.loading = false;
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
	});
</script>

<div class="oer-picker-container">
	<oer-search
		bind:this={searchEl}
	    language={language}
		locked-type="image"
		page-size={12}
	>
		<oer-list bind:this={listEl} {language}></oer-list>
	    <oer-load-more bind:this={loadMoreElement} language={language}></oer-load-more>
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
