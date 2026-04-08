<script lang="ts">
  import { goto } from '$app/navigation';
  import QRCode from 'qrcode';
  import * as Sheet from "$lib/components/ui/sheet/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as Field from "$lib/components/ui/field/index.js";
  import * as Tabs from "$lib/components/ui/tabs/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { authStore } from '$lib/stores/authStore.svelte';
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import QrCodeIcon from "@lucide/svelte/icons/qr-code";
  import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import CheckIcon from "@lucide/svelte/icons/check";
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
  
  // QR Code state
  let qrCodeDataUrl = $state<string | null>(null);
  let connectionUrl = $state<string | null>(null);
  let isGeneratingQr = $state(false);
  let isWaitingForApproval = $state(false);
  let copied = $state(false);
  let qrCanvas = $state<HTMLCanvasElement | null>(null);
  
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
  
  async function generateQrCode() {
    try {
      error = null;
      isGeneratingQr = true;
      
      console.log('[LoginSheet] Starting QR code generation...');
      
      // Add timeout to prevent infinite loading
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('QR generation timeout - check NDK connection')), 10000)
      );
      
      // Generate the nostrconnect URL using authStore with timeout
      const resultPromise = authStore.generateNip46QRCode();
      const result = await Promise.race([resultPromise, timeoutPromise]) as Awaited<typeof resultPromise>;
      
      console.log('[LoginSheet] Got nostrconnect URL:', result.url.substring(0, 50) + '...');
      
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
      
      console.log('[LoginSheet] QR code generated successfully');
      
      // Finish generating state
      isGeneratingQr = false;
      
      // Start waiting for approval
      isWaitingForApproval = true;
      console.log('[LoginSheet] Waiting for mobile approval...');
      
      // Wait for the mobile app to approve (don't await - let it run in background)
      result.waitForApproval()
        .then((user) => {
          if (user) {
            console.log('[LoginSheet] Mobile approval received!');
            isWaitingForApproval = false;
            onClose();
            goto('/cardsboard');
          }
        })
        .catch((approvalError: any) => {
          console.error('[LoginSheet] Approval failed:', approvalError);
          error = approvalError.message || 'Connection was not approved';
          isWaitingForApproval = false;
        });
      
    } catch (err: any) {
      console.error('[LoginSheet] QR generation error:', err);
      error = err.message || 'Failed to generate QR code. Make sure you have an active internet connection.';
      isWaitingForApproval = false;
      isGeneratingQr = false;
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
    error = null;
  }
  
  $effect(() => {
    if (activeTab) {
      error = null;
      // Reset QR code when switching tabs
      if (activeTab !== 'nip46') {
        resetQrCode();
      }
    }
  });
  
  // Reset QR code when dialog closes
  $effect(() => {
    if (!open) {
      resetQrCode();
      nsecInput = '';
      nip46Input = '';
    }
  });
</script>

<Sheet.Root {open} onOpenChange={(newOpen) => !newOpen && onClose()}>
  <Sheet.Content class="w-full sm:max-w-md flex flex-col max-h-[90vh]">
    <Sheet.Header class="flex-shrink-0">
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
    
    <div class="flex-1 overflow-y-auto py-6">
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
            
            {#if !qrCodeDataUrl}
              <!-- Option 1: Generate QR Code for Mobile Bunker App -->
              <div class="border rounded-lg p-4 space-y-3">
                <div class="flex items-center gap-2">
                  <SmartphoneIcon class="w-5 h-5 text-primary" />
                  <h3 class="font-medium">Scan with Mobile Bunker App</h3>
                </div>
                <p class="text-sm text-muted-foreground">
                  Use Amber or another mobile bunker app to sign in securely
                </p>
                <Button 
                  onclick={generateQrCode}
                  disabled={isGeneratingQr || isWaitingForApproval}
                  class="w-full"
                >
                  {#if isGeneratingQr}
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
              <div class="space-y-3">
                <Field.Field>
                  <Field.Label for="nip46-input">Paste Bunker Connection String</Field.Label>
                  <Field.Content>
                    <div class="flex gap-2">
                      <Input
                        id="nip46-input"
                        placeholder="bunker://..."
                        bind:value={nip46Input}
                        disabled={isLoading}
                        class="font-mono text-xs flex-1"
                      />
                    </div>
                  </Field.Content>
                </Field.Field>
                
                <Button 
                  disabled={isLoading || !nip46Input.trim()} 
                  class="w-full" 
                  variant="outline"
                  onclick={handleNip46Login}
                >
                  {#if isLoading}
                    <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                    Connecting...
                  {:else}
                    Connect with Bunker URL
                  {/if}
                </Button>
              </div>
              
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
