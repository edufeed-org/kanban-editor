// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

// The private package currently ships without resolvable type declarations
// in this workspace setup, so we provide a minimal local module shim.
declare module '@edufeed-org/oer-finder-plugin' {
	export function registerAllBuiltInAdapters(): void;
}

export {};
