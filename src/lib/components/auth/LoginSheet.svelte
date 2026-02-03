<script lang="ts">
  import { goto } from '$app/navigation';
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as Field from "$lib/components/ui/field/index.js";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { authStore } from '$lib/stores/authStore.svelte';
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import Nos2x from './assets/nos2x.png';
  import Alby from './assets/alby.svg';
  
  interface Props {
    open: boolean;
    onClose: () => void;
  }
  
  const { open, onClose }: Props = $props();
  
  let nsecInput = $state('');
  let nip46Input = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let activeTab = $state('extension');
  
  async function handleNip07Login() {
    try {
      error = null;
      isLoading = true;
      
      const user = await authStore.loginWithNip07();

      onClose();
      
      if (user) goto('/cardsboard');
    } catch (err: any) {
      error = err.message;
      
      if (err.message.includes('extension not found')) {
        // Redirect to extension installation
        window.open('https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp', '_blank');
      }
    } finally {
      isLoading = false;
    }
  }
  
  async function handleNsecLogin() {
    try {
      error = null;
      isLoading = true;
      
      const user = await authStore.loginWithNsec(nsecInput);
      onClose();
      if (user) goto('/cardsboard');
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }
  
  async function handleNip46Login() {
    try {
      error = null;
      isLoading = true;
      
      const user = await authStore.loginWithNip46(nip46Input);
      onClose();
      if (user) goto('/cardsboard');
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }
  
  $effect(() => {
    if (activeTab) {
      error = null;
    }
  });
</script>

<Sheet.Root {open} onOpenChange={(newOpen) => !newOpen && onClose()}>
  <Sheet.Content class="w-full sm:max-w-md">
    <Sheet.Header>
      <Sheet.Title class="flex items-center gap-2">
        <div class="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
          <KeyRoundIcon class="h-4 w-4 text-purple-600 dark:text-purple-400" />
        </div>
        Sign in to Nostr
      </Sheet.Title>
      <Sheet.Description>
        Choose your preferred authentication method to access the Kanban Board
      </Sheet.Description>
    </Sheet.Header>
    
    <div class="py-6">
      <Tabs.Root bind:value={activeTab} class="w-full">
        <Tabs.List class="grid w-full grid-cols-3">
          <Tabs.Trigger value="extension" disabled={isLoading}>
            Extension
          </Tabs.Trigger>
          <Tabs.Trigger value="nsec" disabled={isLoading}>
            Private Key
          </Tabs.Trigger>
          <Tabs.Trigger value="nip46" disabled={isLoading}>
            NIP-46
          </Tabs.Trigger>
        </Tabs.List>
        
        <!-- Error Display -->
        {#if error}
          <div class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        {/if}
        
        <!-- Browser Extension Tab -->
        <Tabs.Content value="extension" class="mt-4">
          <div class="space-y-4">
            <div class="text-center">
              <div class="mb-4">
                <Badge variant="secondary" class="mb-2">Recommended</Badge>
              </div>
              <p class="text-sm text-muted-foreground mb-4">
                Use your Nostr browser extension for secure authentication
              </p>
            </div>
            
            <div class="grid gap-3">
              <div class="flex items-center gap-3 p-3 border rounded-lg">
                <img src={Alby} alt="Alby" class="w-6 h-10" />
                <div class="flex-1">
                  <a href="https://getalby.com/alby-extension"  target="_blank" class="text-blue-600 hover:underline">
                    <p class="font-medium">Alby</p>
                  </a>
                  <p class="text-xs text-muted-foreground">Lightning Wallet + Nostr</p>
                </div>
              </div>
              
              <div class="flex items-center gap-3 p-3 border rounded-lg">
                <img src={Nos2x} alt="nos2x" class="w-6 h-6" />
                <div class="flex-1">
                  <a href="https://chromewebstore.google.com/detail/nos2x/kpgefcfmnafjgpblomihpgmejjdanjjp/" target="_blank" class="text-blue-600 hover:underline">
                    <p class="font-medium">nos2x</p>
                  </a>
                  <p class="text-xs text-muted-foreground">Nostr Signer Extension</p>
                </div>
              </div>
            </div>
            
            <Button 
              onclick={handleNip07Login} 
              disabled={isLoading}
              class="w-full"
            >
              {#if isLoading}
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {/if}
              Connect Extension
            </Button>
          </div>
        </Tabs.Content>
        
        <!-- Private Key Tab -->
        <Tabs.Content value="nsec" class="mt-4">
          <div class="space-y-4">
            <div class="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
              <div class="flex items-center gap-2 mb-2">
                <span class="text-orange-600 dark:text-orange-400">⚠️</span>
                <span class="font-medium text-orange-800 dark:text-orange-200">Development Only</span>
              </div>
              <p class="text-sm text-orange-700 dark:text-orange-300">
                Only use for testing! Never share your private key.
              </p>
            </div>

            <Field.Field>
              <Field.Label for="nsec-input">Private Key (nsec)</Field.Label>
              <Field.Content>
                <Input
                  id="nsec-input"
                  type="password"
                  placeholder="nsec1..."
                  bind:value={nsecInput}
                  disabled={isLoading}
                  class="font-mono text-sm"
                />
              </Field.Content>
            </Field.Field>
            
            <Button 
              onclick={handleNsecLogin}
              disabled={isLoading || !nsecInput.trim()}
              variant="outline"
              class="w-full"
            >
              {#if isLoading}
                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
              {/if}
              Sign in with nsec
            </Button>
          </div>
        </Tabs.Content>
        
        <!-- NIP-46 Tab -->
        <Tabs.Content value="nip46" class="mt-4">
          <div class="space-y-4">
            <div class="text-center">
              <Badge variant="outline" class="mb-2">Coming Soon</Badge>
              <p class="text-sm text-muted-foreground">
                Connect to remote wallets via NIP-46
              </p>
            </div>
            
            <Field.Field>
              <Field.Label for="nip46-input">Connection String</Field.Label>
              <Field.Content>
                <Input
                  id="nip46-input"
                  placeholder="bunker://..."
                  bind:value={nip46Input}
                  disabled={true}
                  class="font-mono text-sm"
                />
              </Field.Content>
            </Field.Field>
            
            <Button 
              disabled 
              class="w-full" 
              variant="outline"
              onclick={handleNip46Login}
            >
              Connect Wallet (Not Available)
            </Button>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  </Sheet.Content>
</Sheet.Root>

<style>
  :global(.animate-spin) {
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
