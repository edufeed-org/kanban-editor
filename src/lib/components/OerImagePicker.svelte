<script lang="ts">
	import { onMount } from 'svelte';
	import { settingsStore } from '$lib/stores/settingsStore.svelte';

	// Keep these local fallback types so TS stays happy when the optional
	// private plugin package is not installed in local environments.
	type SourceConfig = {
		id: string;
		label: string;
		checked?: boolean;
		baseUrl?: string;
	};

	type OerData = {
		extensions?: {
			images?: {
				high?: string;
				medium?: string;
				small?: string;
			};
		};
		amb?: {
			id?: string;
		};
	};

	type OerSearchResultEvent = CustomEvent<{
		data: OerData[];
		meta: unknown;
	}>;

	type OerCardClickEvent = CustomEvent<{
		oer: OerData;
	}>;

	type OerSearchElement = HTMLElement & {
		sources: SourceConfig[];
	};

	type OerListElement = HTMLElement & {
		loading: boolean;
		oers: OerData[];
		error: string | null;
	};

	type LoadMoreElement = HTMLElement & {
		loading: boolean;
		metadata: unknown;
	};

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
		{ id: 'nostr-amb-relay', label: 'Nostr AMB', checked: true, baseUrl: 'wss://amb-relay.edufeed.org,wss://oersi.edufeed.org' },
		{ id: 'rpi-virtuell', label: 'RPI Virtuell' },
	];

	let searchEl: OerSearchElement;
	let listEl: OerListElement;
	let loadMoreElement: LoadMoreElement;

	onMount(async () => {
		// Dynamically import the plugin only on the client side to avoid SSR issues.
		// Using an indirection avoids hard TS module resolution in environments
		// where the private package is not available.
		const pluginPackage = '@edufeed-org/oer-finder-plugin';
		const plugin = await import(pluginPackage).catch(() => null);
		if (!plugin) {
			console.warn(
				'[OerImagePicker] Optional package "@edufeed-org/oer-finder-plugin" fehlt lokal. ' +
				'Bitte NODE_AUTH_TOKEN setzen/erneuern und danach "pnpm install" ausfuehren.'
			);
			listEl.loading = false;
			listEl.error = 'OER plugin fehlt lokal. Bitte NODE_AUTH_TOKEN aktualisieren und pnpm install ausfuehren.';
			loadMoreElement.loading = false;
			loadMoreElement.metadata = null;
			return;
		}

		const maybeRegisterAdapters = (plugin as { registerAllBuiltInAdapters?: () => void })
			.registerAllBuiltInAdapters;
		if (typeof maybeRegisterAdapters === 'function') {
			maybeRegisterAdapters();
		}

		// Set sources as a JS property (not HTML attribute)
		searchEl.sources = availableSources;

		searchEl?.addEventListener('search-loading', () => {
			listEl.loading = true;
			loadMoreElement.loading = true;
		});
		
		// Handle search results
		searchEl?.addEventListener('search-results', (e: Event) => {
			const customEvent = e as OerSearchResultEvent;
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
			const customEvent = e as OerCardClickEvent;
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
