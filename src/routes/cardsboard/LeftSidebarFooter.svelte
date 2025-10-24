<script lang="ts">
/**
 * Left Sidebar Footer - User Authentication & Profile
 * 
 * 🎯 Integriert LoginDialog unten in der linken Sidebar
 * Zeigt aktuellen User mit Avatar oder Login-Button
 */


	import { Button } from "$lib/components/ui/button/index.js";
	import * as Avatar from "$lib/components/ui/avatar/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import { authStore } from "$lib/stores/authStore.svelte.js";
	import LoginDialog from "./LoginDialog.svelte";
	import LogInIcon from "@lucide/svelte/icons/log-in";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import { ProfileEditor } from '$lib/components/auth/index.js';


	// Reaktive Werte aus AuthStore
	let isAuthenticated = $derived(authStore.isAuthenticated);
	let currentUser = $derived(authStore.currentUser);

	// Dialog State
	let loginDialogOpen = $state(false);

	let showProfileEditor = $state(false);

	async function handleLogout() {
		authStore.logout();
		loginDialogOpen = false;
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
			<DropdownMenu.Trigger>
				<Button
					variant="ghost"
					class="w-full justify-start gap-3 px-2 h-auto py-2 hover:bg-muted"
				>
					<!-- Avatar mit User-Initialen -->
					<Avatar.Root class="h-8 w-8 flex-shrink-0">
						<Avatar.Image src="" alt={currentUser.profile.name} />
						<Avatar.Fallback class={`${Avatar.getAvatarColor(currentUser.profile.name)} text-white text-xs font-semibold`}>
							{Avatar.getInitials(currentUser.profile.name)}
						</Avatar.Fallback>
					</Avatar.Root>

					<!-- User Info -->
					<div class="flex-1 min-w-0 text-left">
						<div class="text-sm font-medium truncate">
							{currentUser.profile.name}
						</div>
						<div
							class="text-xs text-muted-foreground truncate"
							title={currentUser.pubkey}
						>
							{formatPubkey(currentUser.pubkey)}
						</div>
					</div>

					<!-- Dropdown Indicator (wird automatisch hinzugefügt) -->
				</Button>
			</DropdownMenu.Trigger>

			<DropdownMenu.Content align="start" class="w-56">
				<!-- User Info Header -->
				<div class="px-3 py-2">
					<p class="text-sm font-semibold">{currentUser.profile.name}</p>
					<p class="text-xs text-muted-foreground font-mono">
						{formatPubkey(currentUser.pubkey)}
					</p>
				</div>

				<DropdownMenu.Separator />

				<!-- Settings Option -->
				<DropdownMenu.Item onclick={() => showProfileEditor = true} class="gap-2">
					<SettingsIcon class="h-4 w-4" />
					<span>Einstellungen</span>
				</DropdownMenu.Item>

				<!-- Logout -->
				<DropdownMenu.Item onclick={handleLogout} class="gap-2 text-destructive">
					<LogOutIcon class="h-4 w-4" />
					<span>Abmelden</span>
				</DropdownMenu.Item>
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{:else}
		<!-- User ist nicht angemeldet - Login Button -->
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
