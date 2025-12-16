<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		apiUrl?: string;
		language?: string;
		onSelect: (imageUrl: string) => void;
	}

	const { apiUrl = 'http://localhost:3001', language = 'de', onSelect }: Props = $props();

	let searchEl: HTMLElement;
	let listEl: HTMLElement;
	let paginationEl: HTMLElement;

	onMount(async () => {
		// Dynamically import the plugin only on the client side to avoid SSR issues
		await import('@edufeed-org/oer-finder-plugin');
		// Handle search results
		searchEl?.addEventListener('search-results', (e: Event) => {
			const customEvent = e as CustomEvent;
			(listEl as any).oers = customEvent.detail.data;
			(listEl as any).loading = false;
			(paginationEl as any).metadata = customEvent.detail.meta;
		});

		searchEl?.addEventListener('search-error', (e: Event) => {
			const customEvent = e as CustomEvent;
			(listEl as any).oers = [];
			(listEl as any).error = customEvent.detail.error;
		});

		// Handle card selection - extract original image URL
		listEl?.addEventListener('card-click', (e: Event) => {
			const customEvent = e as CustomEvent;
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
