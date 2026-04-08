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
	import QRCode from 'qrcode';
	import LogInIcon from "@lucide/svelte/icons/log-in";
	import UserIcon from "@lucide/svelte/icons/user";
	import KeyRoundIcon from "@lucide/svelte/icons/key-round";
	import QrCodeIcon from "@lucide/svelte/icons/qr-code";
	import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
	import CopyIcon from "@lucide/svelte/icons/copy";
	import CheckIcon from "@lucide/svelte/icons/check";

	let { open = $bindable(false) }: { open: boolean } = $props();

	let nsecInput = $state('');
	let nip46ConnectionString = $state('');
	let isLoading = $derived(authStore.isLoading);
	let errorMessage = $derived(authStore.errorMessage);
	let isAuthenticated = $derived(authStore.isAuthenticated);
	
	// QR Code state
	let qrCodeDataUrl = $state<string | null>(null);
	let connectionUrl = $state<string | null>(null);
	let isGeneratingQr = $state(false);
	let isWaitingForApproval = $state(false);
	let copied = $state(false);

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
	
	// Reset QR code when dialog closes
	$effect(() => {
		if (!open) {
			resetQrCode();
			nsecInput = '';
			nip46ConnectionString = '';
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
	async function handleNip46Login() {
		if (!nip46ConnectionString.trim()) return;
		
		try {
			await authStore.loginWithNip46(nip46ConnectionString);
			open = false;
			nip46ConnectionString = '';
		} catch (error) {
			console.error('NIP-46 login failed:', error);
		}
	}
	
	async function generateQrCode() {
		try {
			isGeneratingQr = true;
			
			console.log('[LoginDialog] Starting QR code generation...');
			
			// Generate the nostrconnect URL using authStore
			const result = await authStore.generateNip46QRCode();
			console.log('[LoginDialog] Got nostrconnect URL:', result.url.substring(0, 50) + '...');
			
			connectionUrl = result.url;
			
			// Generate QR code as data URL
			qrCodeDataUrl = await QRCode.toDataURL(result.url, {
				width: 300,
				margin: 2,
				color: {
					dark: '#000000',
					light: '#FFFFFF'
				}
			});
			
			console.log('[LoginDialog] QR code generated successfully');
			
			// Finish generating state
			isGeneratingQr = false;
			
			// Start waiting for approval
			isWaitingForApproval = true;
			console.log('[LoginDialog] Waiting for mobile approval...');
			
			// Wait for the mobile app to approve (don't await - let it run in background)
			result.waitForApproval()
				.then((user) => {
					if (user) {
						console.log('[LoginDialog] Mobile approval received!');
						isWaitingForApproval = false;
						open = false;
					}
				})
				.catch((approvalError: any) => {
					console.error('[LoginDialog] Approval failed:', approvalError);
					isWaitingForApproval = false;
				});
			
		} catch (err: any) {
			console.error('[LoginDialog] QR generation error:', err);
			isGeneratingQr = false;
			isWaitingForApproval = false;
		}
	}
	
	function copyToClipboard() {
		if (connectionUrl) {
			navigator.clipboard.writeText(connectionUrl);
			copied = true;
			setTimeout(() => copied = false, 2000);
		}
	}
	
	function resetQrCode() {
		qrCodeDataUrl = null;
		connectionUrl = null;
		isWaitingForApproval = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="sm:max-w-md max-h-[90vh] flex flex-col">
		<Dialog.Header class="flex-shrink-0">
			<Dialog.Title class="flex items-center gap-2">
				<LogInIcon class="h-5 w-5" />
				Login
			</Dialog.Title>
			<Dialog.Description class="text-left">
				Wähle eine Authentifizierungsmethode für dein Kanban-Board
			</Dialog.Description>
		</Dialog.Header>

		<div class="overflow-y-auto flex-1 py-4">
			<Tabs value="nip07" class="w-full">
			<TabsList class="grid w-full grid-cols-3">
				<TabsTrigger value="nip07" title="NIP07">
					Browser-Extension
				</TabsTrigger>
				<TabsTrigger value="nsec" title="NSEC">
					nsec
				</TabsTrigger>
				<TabsTrigger value="nip46" title="NIP-46">
					NIP-46
				</TabsTrigger>
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
				onclick={async () => {
					isLoading = true;
					errorMessage = null;
					try {
						await authStore.loginWithNsec(nsecInput);
						open = false;
					} catch (error: any) {
						errorMessage = error.message || 'Login fehlgeschlagen';
					} finally {
						isLoading = false;
					}
				}}
				disabled={isLoading || !nsecInput.trim()}
				variant="outline"
				class="w-full"
			>
				{#if isLoading}
					Logging in...
				{:else}
					<KeyRoundIcon class="h-4 w-4 mr-2" />
					Mit nsec anmelden
				{/if}
			</Button>
		</TabsContent>

		<!-- NIP-46 LOGIN -->
		<TabsContent value="nip46" class="space-y-4">
			{#if !qrCodeDataUrl}
				<!-- Option 1: Generate QR Code for Mobile Bunker App -->
				<div class="border rounded-lg p-4 space-y-3">
					<div class="flex items-center gap-2">
						<SmartphoneIcon class="h-5 w-5 text-primary" />
						<h3 class="font-medium">Scan with Mobile Bunker App</h3>
					</div>
					<p class="text-sm text-muted-foreground">
						Use Amber or another mobile bunker app to sign in securely
					</p>
					<Button 
						onclick={generateQrCode}
						disabled={isGeneratingQr || isWaitingForApproval}
						variant="outline"
						class="w-full"
					>
						{#if isGeneratingQr}
							<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
							Generating QR Code...
						{:else}
							<QrCodeIcon class="h-4 w-4 mr-2" />
							Generate QR Code
						{/if}
					</Button>
				</div>
				
				<div class="relative">
					<div class="absolute inset-0 flex items-center">
						<span class="w-full border-t"></span>
					</div>
					<div class="relative flex justify-center text-xs uppercase">
						<span class="bg-background px-2 text-muted-foreground">Or</span>
					</div>
				</div>
				
				<!-- Option 2: Paste Bunker URL -->
				<div class="space-y-2">
					<Label for="nip46-connection">Bunker Connection String</Label>
					<div class="flex gap-2">
						<Input 
							id="nip46-connection" 
							bind:value={nip46ConnectionString}
							placeholder="bunker://..." 
							type="text" 
							disabled={isLoading}
							class="flex-1 font-mono text-xs"
						/>
					</div>
					<div class="text-xs space-y-2">
						<p class="text-muted-foreground font-semibold">How it works:</p>
						<ol class="list-decimal list-inside space-y-1 text-muted-foreground">
							<li>Open your Nostr wallet</li>
							<li>Create a new "Bunker" connection</li>
							<li>Copy the bunker URL (starts with <code class="bg-muted px-1 rounded">bunker://</code>)</li>
							<li>Paste it here and click "Connect with NIP-46"</li>
						</ol>
					</div>
				</div>

				{#if errorMessage}
					<div class="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
						{errorMessage}
					</div>
				{/if}

				<Button
					onclick={handleNip46Login}
					disabled={isLoading || !nip46ConnectionString.trim()}
					variant="outline"
					class="w-full"
				>
					{#if isLoading}
						Connecting to Remote Signer...
					{:else}
						<UserIcon class="h-4 w-4 mr-2" />
						Connect with NIP-46
					{/if}
				</Button>
			{:else}
				<!-- QR Code Display -->
				<div class="space-y-4">
					<div class="bg-white p-4 rounded-lg border">
						<div class="flex flex-col items-center gap-4">
							{#if qrCodeDataUrl}
								<img src={qrCodeDataUrl} alt="NIP-46 Connection QR Code" class="w-full max-w-[300px]" />
							{/if}
							
							{#if isWaitingForApproval}
								<div class="flex items-center gap-2 text-sm text-muted-foreground">
									<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
									Waiting for approval on your mobile device...
								</div>
							{/if}
						</div>
					</div>
					
					<div class="space-y-2">
						<p class="text-sm font-medium">Instructions:</p>
						<ol class="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
							<li>Open Amber or your bunker app on mobile</li>
							<li>Scan this QR code</li>
							<li>Approve the connection request</li>
							<li>You'll be automatically signed in</li>
						</ol>
					</div>
					
					{#if connectionUrl}
						<div class="space-y-2">
							<p class="text-xs text-muted-foreground">Or copy the connection URL:</p>
							<div class="flex gap-2">
								<Input
									value={connectionUrl}
									readonly
									class="font-mono text-xs"
								/>
								<Button
									size="sm"
									variant="outline"
									onclick={copyToClipboard}
								>
									{#if copied}
										<CheckIcon class="h-4 w-4" />
									{:else}
										<CopyIcon class="h-4 w-4" />
									{/if}
								</Button>
							</div>
						</div>
					{/if}
					
					<Button
						variant="outline"
						class="w-full"
						onclick={resetQrCode}
						disabled={isWaitingForApproval}
					>
						Generate New QR Code
					</Button>
				</div>
			{/if}
		</TabsContent>

	</Tabs>
		</div>

	<Dialog.Footer class="text-xs text-muted-foreground flex-shrink-0">
		🔒 Deine Authentifizierungsdaten werden lokal gespeichert
	</Dialog.Footer>
</Dialog.Content>
</Dialog.Root>
