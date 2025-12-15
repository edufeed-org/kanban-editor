import { authStore } from '../../authStore.svelte.js';

/**
 * Zentralisiert die Pubkey-Ermittlung, weil das AuthStore-API in der Codebase
 * historisch sowohl getPubkeySafe() als auch getPubkey() anbietet.
 */
export function getCurrentPubkeyOrNull(): string | null {
	return (
		(typeof authStore?.getPubkeySafe === 'function' && authStore.getPubkeySafe()) ||
		(typeof authStore?.getPubkey === 'function' && authStore.getPubkey()) ||
		null
	);
}

export function hasCurrentPubkey(): boolean {
	return !!getCurrentPubkeyOrNull();
}
