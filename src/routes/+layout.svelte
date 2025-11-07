<script lang="ts">
  import "../app.css";
  import { createReactivePool } from "@nostr-dev-kit/svelte/stores";
  import { NDKSvelte } from "@nostr-dev-kit/svelte";
  import { setContext, onMount } from 'svelte';
  import { Toaster } from "svelte-sonner";
  import "$lib/utils/demoBoardLoader.js"; // Demo-Funktionen für Browser-Console registrieren
  import "$lib/utils/consoleTip.ts"; // Console-Tipps beim Start anzeigen
  import "$lib/utils/reactiveTestLoader.ts"; // Reaktivitäts-Test-Funktionen
  import { initializeAuth, initializeOidcUserManager } from '$lib/stores/authStore.svelte';
  import { boardStore } from '$lib/stores/kanbanStore.svelte';


  const { children } = $props();

  const ndk = new NDKSvelte({
    explicitRelayUrls: [
      "wss://relay-rpi.edufeed.org/",
      "wss://relay.damus.io/",
    ],
    enableOutboxModel: false // Deaktiviert Standard-Outbox-Relays
  });

  ndk.connect();

  const authStore = initializeAuth(ndk);

  onMount(async () => {
    // Initialize BoardStore with NDK for Nostr publishing
    try {
      boardStore.initializeNostr(ndk);
      console.log('✅ BoardStore initialized with NDK - publishing ready');
    } catch (error) {
      console.error('⚠️ Failed to initialize BoardStore:', error);
    }

    const oidcUserManager = await initializeOidcUserManager(window.location.href)
    // Only process OIDC callback if URL contains 'code' and 'state' parameters
    const urlParams = new URLSearchParams(window.location.search);
    const hasOidcParams = urlParams.has('code') && urlParams.has('state');
    if (hasOidcParams) {
      oidcUserManager.signinCallback().then(user => {
        if (user) {
            authStore.loginWithOidc(user);
        }
      }).catch(err => {
        if (err?.message !== 'No state in response') {
          console.error('OIDC callback failed:', err);
        }
      });
    }
	});

  // Create reactive pool store for Svelte 5
  createReactivePool(ndk);

  setContext('ndk', ndk);
  setContext('authStore', authStore);
</script>

<Toaster 
  richColors 
  position="top-right" 
  closeButton={true}
  duration={1500}
/>

<div class="container viewport w-full h-full max-w-full mx-auto p-0">
    {@render children?.()}
</div>
