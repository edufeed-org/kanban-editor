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

	const apiUrl = $state(settingsStore.settings.oerFinderPlugin.apiUrl)
	const language = $state(settingsStore.settings.oerFinderPlugin.language)
	const { onSelect }: Props = $props();

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

		// Handle card selection - extract original image URL
		listEl?.addEventListener('card-click', (e: Event) => {
			const customEvent = e as CustomEvent<OerCardClickEvent>;
			const oer = customEvent.detail.oer;
			const imageUrl = oer.images?.original || oer.images?.medium || oer.images?.small;
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
		--background-form: var(--muted);
		--text-primary: var(--foreground);
		--text-secondary: var(--muted-foreground);
		--text-muted: var(--muted-foreground);
	}
</style>
