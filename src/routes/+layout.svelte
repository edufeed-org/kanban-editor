<script module lang="ts">
  // 🔧 MODULE-LEVEL SINGLETON: Überlebt Re-Renders
  // Muss in module sein, damit es nicht bei jedem Render zurückgesetzt wird
  import { NDKSvelte } from "@nostr-dev-kit/svelte";
  
  let _cachedNdk: NDKSvelte | null = null;
  let _cachedRelays: string[] = [];
  
  export function getOrCreateNdk(relays: string[]): NDKSvelte {
    // Falls bereits erstellt UND Relays identisch sind → cached zurückgeben
    const relaysKey = relays.slice().sort().join(',');
    const cachedKey = _cachedRelays.slice().sort().join(',');
    
    if (_cachedNdk && relaysKey === cachedKey) {
      return _cachedNdk;
    }
    
    // Neue Instanz nur wenn nötig
    _cachedNdk = new NDKSvelte({
      explicitRelayUrls: relays,
      enableOutboxModel: false
    });
    _cachedRelays = [...relays];
    _cachedNdk.connect();
    console.log('🔌 NDK instance created (singleton)');
    
    return _cachedNdk;
  }
</script>

<script lang="ts">
  import "../app.css";
  import { createReactivePool } from "@nostr-dev-kit/svelte/stores";
  import { setContext, onMount } from 'svelte';
  import { Toaster } from "svelte-sonner";
  // import "$lib/utils/demoBoardLoader.js"; // Demo-Funktionen für Browser-Console registrieren
  // import "$lib/utils/consoleTip.ts"; // Console-Tipps beim Start anzeigen
  // import "$lib/utils/reactiveTestLoader.ts"; // Reaktivitäts-Test-Funktionen
  // import "$lib/utils/nostrPublishingTest.ts"; // 🧪 Nostr Publishing Test Suite
  import { initializeAuth } from '$lib/stores/authStore.svelte';
  import { boardStore } from '$lib/stores/kanbanStore.svelte';
  import { settingsStore } from '$lib/stores/settingsStore.svelte';

  const { children } = $props();

  // ✅ FIX: Relay-URLs dynamisch aus settingsStore laden (public + private + edufeed für vollständige Konnektivität)
  // ⚡ IMPORTANT: Edufeed relays MUST be included from the start for NIP-42 AUTH to work!
  const allRelays = [
    ...settingsStore.settings.relaysPublic,
    ...settingsStore.settings.relaysPrivate,
    ...settingsStore.settings.relaysEdufeed  // ← NEU: Edufeed-Relays für AMB publishing
  ].filter((url, index, arr) => arr.indexOf(url) === index); // Deduplizieren
  
  // 🔧 SINGLETON: Nutze module-level Cache (überlebt Re-Renders)
  const ndk = getOrCreateNdk(allRelays);
  const authStore = initializeAuth(ndk);

  onMount(async () => {
    // Apply theme (system/light/dark) on initial load
    settingsStore.applyTheme();
    // 🔌 FIRST: Wait for NDK to connect before proceeding
    // This prevents "NDK not initialized" race conditions
    // ⚡ OPTIMIZATION: Connection timeout nach 3 Sekunden
    // Note: ndk.connect() was already called in getOrCreateNdk(), this just waits
    try {
      console.log('⏳ Waiting for NDK connection...');
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 3000)
      );
      
      // ndk.connect() returns a promise that resolves when connected
      await Promise.race([ndk.connect(), timeoutPromise]);
      console.log('✅ NDK connected to relays');
    } catch (error) {
      console.warn('⚠️ NDK connection timeout or failed (continuing anyway):', error);
      // Continue anyway - NDK will retry in background
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

    // ✅ THIRD: Initialize BoardStore with NDK for Nostr publishing
    // MUST be BEFORE restoreSession() because onAuthChanged() needs NDK!
    try {
      boardStore.initializeNostr(ndk);
      console.log('✅ BoardStore initialized with NDK - publishing ready');
    } catch (error) {
      console.error('⚠️ Failed to initialize BoardStore:', error);
    }

    // 🔐 FOURTH: Restore AuthStore session
    // At this point: NDK connected, SyncManager ready, BoardStore has NDK
    // restoreSession() will call onAuthChanged() which loads shared boards
    try {
      await authStore.restoreSession();
      console.log('✅ AuthStore session restored');
    } catch (error) {
      console.warn('⚠️ AuthStore session restore failed:', error);
    }
	});

  // Keep theme in sync when settings change
  $effect(() => {
    settingsStore.settings.theme;
    settingsStore.applyTheme();
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
  duration={5000}
/>

<div class="container viewport w-full h-full max-w-full mx-auto p-0">
    {@render children?.()}
</div>
