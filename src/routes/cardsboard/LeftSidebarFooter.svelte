<script lang="ts">
/**
 * Left Sidebar Footer
 */

	import { Button } from "$lib/components/ui/button/index.js";
	import * as Avatar from "$lib/components/ui/avatar/index.js";
	import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { goto } from "$app/navigation";
	import { settingsStore } from "$lib/stores/settingsStore.svelte.js";
	import { authStore } from "$lib/stores/authStore.svelte.js";
	import { boardStore } from "$lib/stores/kanbanStore.svelte.js";
	import LoginDialog from "./LoginDialog.svelte";
	import SettingsDialog from "./SettingsDialog.svelte";
	import SettingsPanel from "$lib/components/settings/SettingsPanel.svelte";
	import RelayStatusInfo from "./RelayStatusInfo.svelte";
	import FAQDialog from "./FAQDialog.svelte";
	import LogInIcon from "@lucide/svelte/icons/log-in";
	import LogOutIcon from "@lucide/svelte/icons/log-out";
	import PlayIcon from "@lucide/svelte/icons/play";
	import SettingsIcon from "@lucide/svelte/icons/settings";
	import UserIcon from "@lucide/svelte/icons/user";
	import PaletteIcon from "@lucide/svelte/icons/palette";
	import BotIcon from "@lucide/svelte/icons/bot";
	import WifiIcon from "@lucide/svelte/icons/wifi";
	import FileTextIcon from "@lucide/svelte/icons/file-text";
	import BookIcon from "@lucide/svelte/icons/book";
	import InfoIcon from "@lucide/svelte/icons/info";
	import HelpCircleIcon from "@lucide/svelte/icons/help-circle";
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
	let uiSettingsOpen = $state(false);
	let llmSettingsOpen = $state(false);
	let defaultsSettingsOpen = $state(false);
	let faqDialogOpen = $state(false);

	// Demo-Error Message
	let demoErrorMessage = $state<string | null>(null);

	async function handleLogout() {
		authStore.logout();
		// Invalidate demo board cache so anonymous users get fresh board from source
		boardStore.invalidateDemoBoardCache();
		loginDialogOpen = false;
		
		// Redirect to main cardsboard if on naddr path
		if (typeof window !== 'undefined' && window.location.pathname.includes('/cardsboard/naddr')) {
			goto('/cardsboard');
		}
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
	<div class="flex items-center gap-2">
		<div class="flex-1">
			{#if isAuthenticated && currentUser}
				<!-- User ist angemeldet -->
				<DropdownMenu.Root>
					<DropdownMenu.Trigger class="bg-secondary rounded-md w-full">
						<div class="px-3 py-3 flex items-center gap-2" data-testid="auth-user-avatar">
							<Avatar.Root class="h-8 w-8 flex-shrink-0">
								<Avatar.Image
									src={currentUser.profile?.picture || currentUser.profile?.image || ""}
									alt={authStore.getDisplayName()}
								/>
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

					<DropdownMenu.Content align="start" class="w-56 ml-4">

						<!-- Profil bearbeiten -->
						<DropdownMenu.Item onclick={() => showProfileEditor = true} class="gap-2 editor-menu-item">
							<UserIcon class="h-4 w-4" />
							<span>Profil bearbeiten</span>
						</DropdownMenu.Item>

						<DropdownMenu.Separator />

						<DropdownMenu.Sub>
							<DropdownMenu.SubTrigger class="gap-2 editor-menu-item">
								<SettingsIcon class="h-4 w-4" />
								<span>Applikation</span>
							</DropdownMenu.SubTrigger>
							<DropdownMenu.SubContent class="w-56">
								<DropdownMenu.Item onclick={() => uiSettingsOpen = true} class="gap-2 editor-menu-item">
									<PaletteIcon class="h-4 w-4" />
									<span>UI & Layout</span>
								</DropdownMenu.Item>
								<DropdownMenu.Item onclick={() => llmSettingsOpen = true} class="gap-2 editor-menu-item">
									<BotIcon class="h-4 w-4" />
									<span>KI-Anbindung</span>
								</DropdownMenu.Item>
								<DropdownMenu.Item onclick={() => settingsStore.openNostrSettingsDialog()} class="gap-2 editor-menu-item">
									<WifiIcon class="h-4 w-4" />
									<span>Nostr Relays</span>
								</DropdownMenu.Item>
								<DropdownMenu.Item onclick={() => defaultsSettingsOpen = true} class="gap-2 editor-menu-item">
									<FileTextIcon class="h-4 w-4" />
									<span>Standard-Werte</span>
								</DropdownMenu.Item>
							</DropdownMenu.SubContent>
						</DropdownMenu.Sub>

						<DropdownMenu.Sub>
							<DropdownMenu.SubTrigger class="gap-2 editor-menu-item">
								<FileTextIcon class="h-4 w-4" />
								<span>Wissenswertes</span>
							</DropdownMenu.SubTrigger>
							<DropdownMenu.SubContent class="w-48">
								<DropdownMenu.Item
									onclick={() => window.open(settingsStore.settings.sourceCodeUrl, "_blank")}
									class="gap-2 editor-menu-item"
								>
									<FileTextIcon class="h-4 w-4" />
									<span>Source Code</span>
								</DropdownMenu.Item>
								<DropdownMenu.Item
									onclick={() => window.open(settingsStore.settings.documentationUrl, "_blank")}
									class="gap-2 editor-menu-item"
								>
									<BookIcon class="h-4 w-4" />
									<span>Dokumentation</span>
								</DropdownMenu.Item>
								<DropdownMenu.Item
									onclick={() => window.open(settingsStore.settings.aboutUrl, "_blank")}
									class="gap-2 editor-menu-item"
								>
									<InfoIcon class="h-4 w-4" />
									<span>Über</span>
								</DropdownMenu.Item>
								<DropdownMenu.Separator />
								<DropdownMenu.Item
									onclick={() => faqDialogOpen = true}
									class="gap-2 editor-menu-item"
								>
									<HelpCircleIcon class="h-4 w-4" />
									<span>FAQ</span>
								</DropdownMenu.Item>
							</DropdownMenu.SubContent>
						</DropdownMenu.Sub>
						
						<DropdownMenu.Separator />
						
						<!-- Logout -->
						<DropdownMenu.Item onclick={handleLogout} class="gap-2 destructive menu-item">
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
					data-testid="login-button"
				>
					<LogInIcon class="h-4 w-4" />
					<span>Anmelden</span>
				</Button>
			{/if}
		</div>
	</div>
	
	{#if !isAuthenticated}

		<p class="text-xs text-muted-foreground mt-3 text-center">
			Melde dich an, um Boards zu erstellen
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

<!-- FAQ Dialog -->
<FAQDialog bind:open={faqDialogOpen} />

<ProfileEditor
    open={showProfileEditor}
    onClose={() => showProfileEditor = false}
/>

<!-- UI/UX Settings Dialog -->
<SettingsDialog bind:open={uiSettingsOpen} title="UI & Layout Einstellungen" icon={PaletteIcon} tab="ui" />

<!-- LLM Settings Dialog -->
<SettingsDialog bind:open={llmSettingsOpen} title="LLM Einstellungen" icon={BotIcon} tab="llm" />

<!-- Nostr Relay Settings Dialog -->
<Dialog.Root bind:open={settingsStore.nostrSettingsDialogOpen}>
	<Dialog.Content class="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<WifiIcon class="h-5 w-5" />
				Nostr Relay Einstellungen
			</Dialog.Title>
		</Dialog.Header>
		<div class="py-4 space-y-4">
			<div class="pb-4 border-b">
				<RelayStatusInfo />
			</div>
			<SettingsPanel defaultTab="nostr" showHeader={false} showTabs={false} />
		</div>
	</Dialog.Content>
</Dialog.Root>

<!-- Defaults Settings Dialog -->
<SettingsDialog bind:open={defaultsSettingsOpen} title="Standard-Werte" icon={FileTextIcon} tab="defaults" />

<style>
	/* Verhindere Flex-Shrinking für Avatar */
	:global([class*="avatar"]) {
		flex-shrink: 0;
	}
</style>

