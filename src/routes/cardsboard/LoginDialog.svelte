<script lang="ts">
/**
 * Login Modal - Basics Authentication UI
 * 
 * Ermöglicht Benutzer-Login mit Dummy-User
 * Später wird dies durch richtige NIP-07 Authentication ersetzt
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

	let userName = $state('Dev User');
	let nsecInput = $state('');
	let isLoading = $derived(authStore.isLoading);
	let errorMessage = $derived(authStore.errorMessage);

	async function handleDummyLogin() {
		const success = await authStore.loginWithDummy(userName);
		if (success) {
			open = false;
			userName = 'Dev User'; // Reset
		}
	}

	async function handleNsecLogin() {
		const success = await authStore.loginWithNsec(nsecInput, 'nsec User');
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
			<Dialog.Description>
				Wähle eine Authentifizierungsmethode für dein Kanban-Board
			</Dialog.Description>
		</Dialog.Header>

		<Tabs value="dummy" class="w-full">
			<TabsList class="grid w-full grid-cols-3">
				<TabsTrigger value="dummy">
					<UserIcon class="h-4 w-4 mr-2" />
					Dummy
				</TabsTrigger>
				<TabsTrigger value="nsec" title="WIP">
					<KeyRoundIcon class="h-4 w-4 mr-2" />
					nsec
				</TabsTrigger>
				<TabsTrigger value="nip07" title="WIP">
					<LogInIcon class="h-4 w-4 mr-2" />
					NIP-07
				</TabsTrigger>
			</TabsList>

			<!-- DUMMY USER LOGIN -->
			<TabsContent value="dummy" class="space-y-4">
				<div class="space-y-2">
					<Label for="username">Display Name</Label>
					<Input
						id="username"
						bind:value={userName}
						placeholder="z.B. 'Dev User'"
						disabled={isLoading}
					/>
				</div>

				<p class="text-xs text-muted-foreground">
					ℹ️ Dies erstellt einen Dummy-User mit Mock-Daten für lokale Tests.
				</p>

				{#if errorMessage}
					<div class="bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded text-sm">
						{errorMessage}
					</div>
				{/if}

				<Button
					onclick={handleDummyLogin}
					disabled={isLoading || !userName}
					class="w-full"
				>
					{#if isLoading}
						Wird geladen...
					{:else}
						<LogInIcon class="h-4 w-4 mr-2" />
						Mit Dummy anmelden
					{/if}
				</Button>
			</TabsContent>

			<!-- NSEC LOGIN (WIP) -->
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

			<!-- NIP-07 LOGIN (WIP) -->
			<TabsContent value="nip07" class="space-y-4">
				<div class="space-y-2">
					<p class="text-sm text-muted-foreground">
						Verbinde dich mit einer Browser-Extension wie Alby oder nos2x.
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
						Mit NIP-07 anmelden
					{/if}
				</Button>
			</TabsContent>
		</Tabs>

		<Dialog.Footer class="text-xs text-muted-foreground">
			🔒 Deine Authentifizierungsdaten werden lokal gespeichert
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
