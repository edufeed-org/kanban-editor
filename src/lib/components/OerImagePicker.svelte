<script lang="ts">
	import 'reflect-metadata'; // decorator polyfill for web components, needed for oer-finder-plugin
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

	let searchEl: OerSearchElement;
	let listEl: OerListElement;
	let paginationEl: PaginationElement;

	onMount(async () => {
		try {
			// Dynamically import the plugin only on the client side
			// reflect-metadata is already loaded at component import time above
			await import('@edufeed-org/oer-finder-plugin');
		} catch (error) {
			console.error('Failed to load OER plugin:', error);
			return;
		}
		
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
		--background-form: var(--background);
	    --background-input: var(--background);
		--text-primary: var(--foreground);
		--text-secondary: var(--foreground);
		--text-muted: var(--muted-foreground);
		--border-color: var(--border);
		--input-border-color: var(--border);
	}
</style>
