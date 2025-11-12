<script lang="ts">
/**
 * Left Sidebar Footer - User Authentication & Profile
 * 
 * 🎯 Integriert LoginDialog unten in der linken Sidebar
 * Zeigt aktuellen User mit Avatar oder Login-Button
 * Mit Demo-Session-Unterstützung (optional, config-gesteuert)
 */


	import { Button } from "$lib/components/ui/button/index.js";
	import * as Avatar from "$lib/components/ui/avatar/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import { authStore } from "$lib/stores/authStore.svelte.js";
	import LoginDialog from "./LoginDialog.svelte";
	import LogInIcon from "@lucide/svelte/icons/log-in";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import PlayIcon from "@lucide/svelte/icons/play";
	import { ProfileEditor } from '$lib/components/auth/index.js';


	// Reaktive Werte aus AuthStore
	let isAuthenticated = $derived(authStore.isAuthenticated);
	let currentUser = $derived(authStore.currentUser);

	// Check ob Demo-Sessions erlaubt sind
	// WICHTIG: Dies wird dynamisch neu berechnet, nicht nur beim Initialize
	let isDemoAllowed = $derived(authStore.isDemoSessionAllowed());

	// Dialog State
	let loginDialogOpen = $state(false);

	let showProfileEditor = $state(false);

	// Demo-Error Message
	let demoErrorMessage = $state<string | null>(null);

	async function handleLogout() {
		authStore.logout();
		loginDialogOpen = false;
	}

	async function handleDemoSession() {
		try {
			demoErrorMessage = null;
			authStore.createDemoSession();
			console.log('✅ Demo-Session gestartet');
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			demoErrorMessage = errorMsg;
			console.error('❌ Demo-Session konnte nicht gestartet werden:', error);
		}
	}

	/**
	 * Formatiert Public Key für Anzeige
	 * "0000...0001" statt "0000000000000000000000000000000000000000000000000000000000000001"
	 */
	function formatPubkey(pubkey?: string): string {
		if (!pubkey) return 'Unknown';
		return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
	}
</script>

<!-- User Section - sticky unten in der Sidebar -->
<div class="mt-auto pt-4 border-t border-border/40">
	{#if isAuthenticated && currentUser}
		<!-- User ist angemeldet -->
		<DropdownMenu.Root>
			<DropdownMenu.Trigger class="bg-secondary rounded-md">
				<div class="px-3 py-3 flex items-center gap-2">
					<Avatar.Root class="h-8 w-8 flex-shrink-0">
						<Avatar.Image src="" alt={authStore.getDisplayName()} />
						<Avatar.Fallback class={`${authStore.getAvatarColor()} text-white text-xs font-semibold`}>
							{authStore.getUserInitials()}
						</Avatar.Fallback>
					</Avatar.Root>
					<div>
						<p class="text-sm font-semibold">{authStore.getDisplayName()}</p>
						<p class="text-xs text-muted-foreground font-mono">
							{formatPubkey(currentUser.pubkey)}
						</p>
					</div>
				</div>
				
			</DropdownMenu.Trigger>

			<DropdownMenu.Content align="start" class="w-56">
				
				<!-- Settings Option -->
				<DropdownMenu.Item onclick={() => showProfileEditor = true} class="gap-2 menu-item">
					<SettingsIcon class="h-4 w-4" />
					<span>Einstellungen</span>
				</DropdownMenu.Item>

				<!-- Logout -->
				<DropdownMenu.Item onclick={handleLogout} class="gap-2 destructive menu-item">
					<LogOutIcon class="h-4 w-4" />
					<span>Abmelden</span>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{:else}
		<!-- User ist nicht angemeldet - Login Button + Demo Option -->
		<Button
			onclick={() => (loginDialogOpen = true)}
			variant="outline"
			class="w-full gap-2"
			size="sm"
		>
			<LogInIcon class="h-4 w-4" />
			<span>Anmelden</span>
		</Button>

		<p class="text-xs text-muted-foreground mt-3 text-center">
			Melde dich an um Karten zu erstellen
		</p>

		<!-- Demo-Button (nur wenn erlaubt) -->
		{#if isDemoAllowed}
			<Button
				onclick={handleDemoSession}
				variant="link"
				class="w-full mt-2"
				size="sm"
			>
				<PlayIcon class="h-4 w-4 mr-1" />
				Demo starten
			</Button>
			
			{#if demoErrorMessage}
				<div class="bg-red-50 border border-red-200 text-red-800 px-2 py-1 rounded text-xs mt-2">
					{demoErrorMessage}
				</div>
			{/if}
		{:else}
			<div class="text-xs text-muted-foreground mt-3 text-center italic">
				<!-- Demo-Sessions sind deaktiviert -->
			</div>
		{/if}
	{/if}
</div>

<!-- Login Dialog -->
<LoginDialog bind:open={loginDialogOpen} />

<ProfileEditor
    open={showProfileEditor}
    onClose={() => showProfileEditor = false}
/>

<style>
	/* Verhindere Flex-Shrinking für Avatar */
	:global([class*="avatar"]) {
		flex-shrink: 0;
	}
</style>

