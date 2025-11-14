<script lang="ts">
  import "../app.css";
  import { createReactivePool } from "@nostr-dev-kit/svelte/stores";
  import { NDKSvelte } from "@nostr-dev-kit/svelte";
  import { setContext, onMount } from 'svelte';
  import { Toaster } from "svelte-sonner";
  // import "$lib/utils/demoBoardLoader.js"; // Demo-Funktionen für Browser-Console registrieren
  // import "$lib/utils/consoleTip.ts"; // Console-Tipps beim Start anzeigen
  // import "$lib/utils/reactiveTestLoader.ts"; // Reaktivitäts-Test-Funktionen
  // import "$lib/utils/nostrPublishingTest.ts"; // 🧪 Nostr Publishing Test Suite
  import { initializeAuth, initializeOidcUserManager } from '$lib/stores/authStore.svelte';
  import { boardStore } from '$lib/stores/kanbanStore.svelte';
  import { settingsStore } from '$lib/stores/settingsStore.svelte';


  const { children } = $props();

  // ✅ FIX: Relay-URLs dynamisch aus settingsStore laden statt hardcoded
  const ndk = new NDKSvelte({
    explicitRelayUrls: settingsStore.settings.relaysPublic,
    enableOutboxModel: false // Deaktiviert Standard-Outbox-Relays
  });

  // 🚀 Start connection immediately (async)
  ndk.connect();

  const authStore = initializeAuth(ndk);

  onMount(async () => {
    // 🔌 FIRST: Wait for NDK to connect before proceeding
    // This prevents "NDK not initialized" race conditions
    try {
      console.log('⏳ Waiting for NDK connection...');
      await ndk.connect();
      console.log('✅ NDK connected to relays');
    } catch (error) {
      console.warn('⚠️ NDK connection failed (continuing anyway):', error);
    }

    // 🔑 SECOND: Initialize SyncManager (before AuthStore restores session)
    // This ensures SyncManager.updateSigner() works when AuthStore restores NIP-07
    try {
      const { initializeSyncManager } = await import('$lib/stores/syncManager.svelte');
      initializeSyncManager(ndk, undefined);
      console.log('✅ SyncManager initialized');
    } catch (error) {
      console.warn('⚠️ SyncManager init failed:', error);
    }

    // 🔐 THIRD: Restore AuthStore session
    // At this point, SyncManager is ready to receive updateSigner() calls
    try {
      await authStore.restoreSession();
      console.log('✅ AuthStore session restored');
    } catch (error) {
      console.warn('⚠️ AuthStore session restore failed:', error);
    }

    // ✅ FOURTH: Initialize BoardStore with NDK for Nostr publishing
    // At this point: NDK is connected, authStore has session, SyncManager has signer
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

  // Aktualisiere Board-Author wenn User sich einloggt
  $effect(() => {
    if (authStore.isAuthenticated) {
      console.log('🔐 User eingeloggt, aktualisiere Board-Author...');
      // Dynamischer Import um circular dependency zu vermeiden
      import('$lib/stores/kanbanStore.svelte').then(({ boardStore }) => {
        boardStore.updateBoardAuthor();
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
  duration={3000}
/>

<div class="container viewport w-full h-full max-w-full mx-auto p-0">
    {@render children?.()}
</div>
