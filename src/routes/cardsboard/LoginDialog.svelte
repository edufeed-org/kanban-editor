<script lang="ts">
/**
 * Login Modal - Basics Authentication UI
 */


	import { Button } from "$lib/components/ui/button/index.js";
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { Label } from "$lib/components/ui/label/index.js";
	import { Tabs, TabsContent, TabsList, TabsTrigger } from "$lib/components/ui/tabs/index.js";
	import { authStore } from "$lib/stores/authStore.svelte.js";
	import LogInIcon from "@lucide/svelte/icons/log-in";
	import UserIcon from "@lucide/svelte/icons/user";
	import KeyRoundIcon from "@lucide/svelte/icons/key-round";

	let { open = $bindable(false) }: { open: boolean } = $props();

	let nsecInput = $state('');
	let isLoading = $derived(authStore.isLoading);
	let errorMessage = $derived(authStore.errorMessage);
	let isAuthenticated = $derived(authStore.isAuthenticated);

	// Track if dialog was open when auth was NOT active, then close after fresh auth			// This prevents premature closing if user was already authenticated
	let wasUnauthenticatedWhenOpened = $state(false);
	
	$effect(() => {
		if (open && !isAuthenticated) {
			wasUnauthenticatedWhenOpened = true;
		} else if (!open) {
			// Reset when dialog closes
			wasUnauthenticatedWhenOpened = false;
		}
	});

	// Auto-close after successful login (with small delay to avoid race conditions)
	$effect(() => {
		if (wasUnauthenticatedWhenOpened && isAuthenticated && open && !isLoading) {
			// Small delay to ensure all UI updates complete before closing
			setTimeout(() => {
				console.log('[LoginDialog] Closing after successful auth');
				open = false;
				nsecInput = '';
				wasUnauthenticatedWhenOpened = false;
			}, 500);
		}
	});

	// Browser detection
	let browserType = $state<'chrome' | 'firefox' | 'safari' | 'edge' | 'opera' | 'brave' | 'unknown'>('unknown');
	
	$effect(() => {
		if (typeof window !== 'undefined') {
			const ua = navigator.userAgent.toLowerCase();
			
			// Check for specific browsers (order matters!)
			if (ua.includes('edg/') || ua.includes('edge')) {
				browserType = 'edge';
			} else if (ua.includes('opr/') || ua.includes('opera')) {
				browserType = 'opera';
			} else if (ua.includes('brave')) {
				browserType = 'brave';
			} else if (ua.includes('firefox')) {
				browserType = 'firefox';
			} else if (ua.includes('safari') && !ua.includes('chrome')) {
				browserType = 'safari';
			} else {
				browserType = 'chrome';
			}
		}
	});

	// Extension links based on browser
	const extensionLinks = $derived({
		alby: browserType === 'firefox' 
			? 'https://addons.mozilla.org/firefox/addon/alby/'
			: browserType === 'safari'
			? 'https://apps.apple.com/app/alby/id6451892291'
			: 'https://chrome.google.com/webstore/detail/alby/iokeahhehimjnekafflcihljlcjccdbe',
		nos2x: browserType === 'firefox'
			? 'https://addons.mozilla.org/firefox/addon/nos2x/'
			: browserType === 'safari'
			? null // nos2x not available on Safari
			: 'https://chrome.google.com/webstore/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp'
	});

	async function handleNsecLogin() {
		const success = await authStore.loginWithNsec(nsecInput);
		if (success) {
			open = false;
			nsecInput = ''; // Reset
		}
	}

	async function handleNip07Login() {
		const success = await authStore.loginWithNip07();
		if (success) {
			open = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md">
		<Dialog.Header>
			<Dialog.Title class="flex items-center gap-2">
				<LogInIcon class="h-5 w-5" />
				Login
			</Dialog.Title>
			<Dialog.Description class="text-left">
				Wähle eine Authentifizierungsmethode für dein Kanban-Board
			</Dialog.Description>
		</Dialog.Header>

		<Tabs value="nip07" class="w-full">
			<TabsList class="grid w-full grid-cols-2">
				<TabsTrigger value="nip07" title="NIP07">
					Browser-Extension
				</TabsTrigger>
				<TabsTrigger value="nsec" title="NSEC">
					nsec
				</TabsTrigger>
				<!-- 
				<TabsTrigger value="nip46" disabled title="WIP">
					<UserIcon class="h-4 w-4 mr-2" />
					NIP-46
				</TabsTrigger> 
				-->
			</TabsList>

			<!-- NIP-07 LOGIN -->
			<TabsContent value="nip07" class="space-y-4">
				<div class="space-y-2">
					<p class="text-sm text-muted-foreground">
						1. Schritt: Such dir eine Browser-Extension:
					</p>
					<div class="text-xs text-muted-foreground space-y-1 border-l-2 border-primary/20 pl-3 py-2">
						<div class="flex flex-col gap-1">
							<a 
								href={extensionLinks.alby} 
								target="_blank" 
								rel="noopener noreferrer"
								class="text-primary hover:underline flex items-center gap-1"
							>
								→ Alby Extension
							</a>
							{#if extensionLinks.nos2x}
								<a 
									href={extensionLinks.nos2x} 
									target="_blank" 
									rel="noopener noreferrer"
									class="text-primary hover:underline flex items-center gap-1"
								>
									→ nos2x Extension
								</a>
							{/if}
						</div>
					</div>
					<p class="text-sm text-muted-foreground">
						2. Schritt: Konfiguriere die Extension mit deinem Nostr-Schlüssel-Paar. 
						Falls du keine Nostr-Schlüssel hast, lass dich welche auf dem 
						<a 
							href="https://edufeed-org.github.io/onboarding-tool/" 
							target="_blank" 
							class="font-bold"
						>
							Onboarding-Tool
						</a> 
						generieren. 
					</p>
					<p class="text-sm text-muted-foreground">
						3. Schritt: Klick auf Button unten und erlaube unsere App.
					</p>
				</div>

				{#if errorMessage}
					<div class="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
						{errorMessage}
					</div>
				{/if}

				<Button
					onclick={handleNip07Login}
					disabled={isLoading}
					variant="outline"
					class="w-full"
				>
					{#if isLoading}
						Wird geladen...
					{:else}
						<LogInIcon class="h-4 w-4 mr-2" />
						Mit Nostr-Extension anmelden
					{/if}
				</Button>
			</TabsContent>

			<!-- NSEC LOGIN -->
			<TabsContent value="nsec" class="space-y-4">
				<div class="space-y-2">
					<Label for="nsec">Private Key (nsec)</Label>
					<Input
						id="nsec"
						bind:value={nsecInput}
						placeholder="nsec1..."
						type="password"
						disabled={isLoading}
					/>
				</div>

				<p class="text-xs text-amber-600 font-semibold">
					⚠️ Niemals den privaten Schlüssel öffentlich teilen oder in Production nutzen!
				</p>

				{#if errorMessage}
					<div class="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
						{errorMessage}
					</div>
				{/if}

				<Button
					onclick={handleNsecLogin}
					disabled={isLoading || !nsecInput}
					variant="outline"
					class="w-full"
				>
					{#if isLoading}
						Wird geladen...
					{:else}
						<KeyRoundIcon class="h-4 w-4 mr-2" />
						Mit nsec anmelden
					{/if}
				</Button>
			</TabsContent>

			<!-- NIP-46 LOGIN (WIP)-->
			<TabsContent value="nip46" class="space-y-4">
				<div class="space-y-2">
					<p class="text-sm text-muted-foreground">
						Remote Signer (NIP-46) verwenden — URL des Signer-Services und optionaler Pubkey des Signers.
					</p>

					<form class="space-y-2">
						<div>
							<Label for="nip46-url">Signer URL</Label>
							<Input id="nip46-url" name="nip46-url" placeholder="https://signer.example.com" type="url" disabled={isLoading} />
						</div>

						<div>
							<Label for="nip46-pubkey">Signer Pubkey (optional)</Label>
							<Input id="nip46-pubkey" name="nip46-pubkey" placeholder="npub1..." type="text" disabled={isLoading} />
						</div>
					</form>
				</div>

				{#if errorMessage}
					<div class="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
						{errorMessage}
					</div>
				{/if}

				<p class="text-xs text-amber-600 font-semibold">
					⚠️ Remote Signing: Vertraue nur Signer, denen du vertraust. Private Keys verbleiben beim Signer.
				</p>

				<Button
					onclick={async (e) => {
						const form = (e.currentTarget as HTMLElement).closest('form');
						const remoteUrl = (form?.querySelector('input[name="nip46-url"]') as HTMLInputElement)?.value || '';
						if (typeof authStore.loginWithNip46 !== 'function') {
							console.error('loginWithNip46 not implemented on authStore');
							return;
						}
						const success = await authStore.loginWithNip46(remoteUrl);
						if (success) {
							open = false;
							if (form) {
								(form.querySelector('input[name="nip46-url"]') as HTMLInputElement).value = '';
								(form.querySelector('input[name="nip46-pubkey"]') as HTMLInputElement).value = '';
							}
						}
					}}
					disabled={isLoading}
					variant="outline"
					class="w-full"
				>
					{#if isLoading}
						Wird geladen...
					{:else}
						<UserIcon class="h-4 w-4 mr-2" />
						Mit NIP-46 anmelden
					{/if}
				</Button>
			</TabsContent>

		</Tabs>

		<Dialog.Footer class="text-xs text-muted-foreground">
			🔒 Deine Authentifizierungsdaten werden lokal gespeichert
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
