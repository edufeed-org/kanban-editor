import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writable } from 'svelte/store';


// Mock persisted store to use a plain svelte writable so AuthStore can use get()/set()
vi.mock('svelte-persisted-store', () => {
	return {
		persisted: (key: string, initial: any) => {
			const store = writable(initial);
			return store;
		}
	};
});

// Provide a minimal mock NDK instance used by the AuthStore constructor
const mockNdk = {
	fetchUser: vi.fn(async (pubkey: string) => {
		return { pubkey, npub: `npub-${pubkey}`, profile: { name: 'Fetched User' } };
	}),
	signer: undefined
};

// Now import the AuthStore implementation
import { AuthStore } from '$lib/stores/authStore.svelte.js';

describe('AuthStore (unit)', () => {
	let store: any;

	beforeEach(() => {
		// reset globals and modules
		vi.resetModules();
		localStorage.clear();
		// ensure window.nostr removed by default
		// @ts-ignore
		delete globalThis.nostr;
		store = new AuthStore(mockNdk as any);
	});

	it('createDemoSession sets currentUser and session', () => {
		// enable demo via localStorage config
		localStorage.setItem('kanban-config', JSON.stringify({ allow_demo_session: { enabled: true } }));

		store.createDemoSession();

		expect(store.currentUser).toBeTruthy();
		expect(store.getUserName()).toBe('Demo User');

		const info = store.getSessionInfo();
		expect(info.session).toBeTruthy();
		expect(info.session.signerType).toBe('demo');
	});

	it('logout clears session and currentUser', async () => {
		localStorage.setItem('kanban-config', JSON.stringify({ allow_demo_session: { enabled: true } }));
		store.createDemoSession();

		await store.logout();

		expect(store.currentUser).toBeNull();
		const info = store.getSessionInfo();
		expect(info.session).toBeNull();
	});

	it('loginWithNip46 throws not implemented', async () => {
		await expect(store.loginWithNip46('anything')).rejects.toThrow();
	});

	it.skip('loginWithNsec accepts valid nsec and sets currentUser', async () => {
		// create a valid nsec of length 63 starting with nsec1
		const nsec = 'nsec1' + 'a'.repeat(58);
		const result = await store.loginWithNsec(nsec);
		expect(result).toBeTruthy();
		expect(store.currentUser).toBeTruthy();
		expect(store.getPubkey()).toBeDefined();
	});

	it.skip('loginWithNip07 requires window.nostr and sets currentUser', async () => {
		// provide window.nostr
		// @ts-ignore
		globalThis.nostr = {};

		const result = await store.loginWithNip07();
		expect(result).toBeTruthy();
		expect(store.currentUser).toBeTruthy();
		expect(store.getUserName()).toBe('Nip07 User');
	});

	it('isDemoSessionAllowed respects config in localStorage', () => {
		localStorage.setItem('kanban-config', JSON.stringify({ allow_demo_session: { enabled: true } }));
		expect(store.isDemoSessionAllowed()).toBe(true);
		localStorage.setItem('kanban-config', JSON.stringify({ allow_demo_session: { enabled: false } }));
		expect(store.isDemoSessionAllowed()).toBe(false);
	});

	it('updateProfile updates currentUser profile and persisted session', async () => {
		// create demo session first
		localStorage.setItem('kanban-config', JSON.stringify({ allow_demo_session: { enabled: true } }));
		store.createDemoSession();

		await store.updateProfile({ name: 'New Name' });

		expect(store.getUserName()).toBe('New Name');
		const info = store.getSessionInfo();
		expect(info.session.profile.name).toBe('New Name');
	});

	it('verifyNip05 returns true when names match', async () => {
		// set current user with pubkey
		store.currentUser = { pubkey: 'test-pubkey' } as any;

		// return a minimal Response-like object (cast to any to satisfy TS)
		globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ names: { alice: 'test-pubkey' } }) } as any));

		const ok = await store.verifyNip05('alice@example.com');
		// our mock uses 'alice' mapping to 'test-pubkey'
		expect(ok).toBe(true);
	});

	it('getPubkey/getNpub/getUserName/getStatus return expected values', () => {
		store.currentUser = { pubkey: 'p1', npub: 'np1', profile: { name: 'Me' } } as any;
		expect(store.getPubkey()).toBe('p1');
		expect(store.getNpub()).toBe('np1');
		expect(store.getUserName()).toBe('Me');
		const status = store.getStatus();
		expect(status.user).toBe(store.currentUser);
	});
});

