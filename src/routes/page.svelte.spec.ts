import { page } from '@vitest/browser/context';
import { describe, expect, it, beforeAll } from 'vitest';
import { render } from 'vitest-browser-svelte';
import Page from './+page.svelte';
import { initializeAuth } from '$lib/stores/authStore.svelte';
import { NDKSvelte } from '@nostr-dev-kit/svelte';

describe('/+page.svelte', () => {
	beforeAll(() => {
		// Initialize authStore before rendering components
		// This ensures authStore is always defined at runtime
		const ndk = new NDKSvelte({
			explicitRelayUrls: [
				'wss://relay-rpi.edufeed.org/',
				'wss://relay.damus.io/',
			],
			enableOutboxModel: false
		});
		initializeAuth(ndk);
	});

	it('should render h1', async () => {
		render(Page);
		
		const heading = page.getByRole('heading', { level: 1 });
		await expect.element(heading).toBeInTheDocument();
	});
});
