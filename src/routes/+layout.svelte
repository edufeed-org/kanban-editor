<script lang="ts">
  import "../app.css";
  import { createReactivePool } from "@nostr-dev-kit/svelte/stores";
  import { NDKSvelte } from "@nostr-dev-kit/svelte";
  import "$lib/utils/demoBoardLoader.js"; // Demo-Funktionen für Browser-Console registrieren
  import "$lib/utils/consoleTip.ts"; // Console-Tipps beim Start anzeigen
  import "$lib/utils/reactiveTestLoader.ts"; // Reaktivitäts-Test-Funktionen
  import { initializeAuth } from '$lib/stores/authStore.svelte';
  import { setContext } from 'svelte';
  import LoginSheet from '$lib/components/auth/LoginSheet.svelte';
  import UserHeader from '$lib/components/auth/UserHeader.svelte';
  import ProfileEditor from '$lib/components/auth/ProfileEditor.svelte';
  import { Button } from "$lib/components/ui/button/index.js";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";


  interface Props {
    children?: any;
  }

  const { children } = $props();

  const ndk = new NDKSvelte({
    explicitRelayUrls: [
      "ws://localhost:4869",
      "wss://relay-rpi.edufeed.org/",
    ],
    enableOutboxModel: false // Deaktiviert Standard-Outbox-Relays
  });

  const pool = createReactivePool(ndk);

  ndk.connect();
    
  const authStore = initializeAuth(ndk);
  
  let showLoginSheet = $state(false);
  let showProfileEditor = $state(false);

  setContext('ndk', ndk);
  setContext('authStore', authStore);
</script>


<div class="min-h-screen bg-background">
  <!-- Top Navigation -->
  <header class="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
    <div class="container flex h-14 items-center justify-between">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-semibold">Kanban Board</h1>
      </div>
      
      <div class="flex items-center gap-4">
        <UserHeader 
          onOpenProfile={() => showProfileEditor = true}
          onOpenSettings={() => {/* TODO: Settings */}}
        />
        
        {#if !authStore.isAuthenticated}
          <Button variant="default" size="sm" onclick={() => showLoginSheet = true}>
            <KeyRoundIcon class="mr-2 h-4 w-4" />
            Sign In
          </Button>
        {/if}
      </div>
    </div>
  </header>
  
  <!-- Main Content -->
  <main class="container viewport w-full h-full max-w-full mx-auto p-0">
    {#if authStore.isAuthenticated}
      {@render children?.()}
    {:else}
      <div class="flex items-center justify-center min-h-[60vh]">
        <div class="text-center space-y-4">
          <h2 class="text-2xl font-semibold">Welcome to Kanban Board</h2>
          <p class="text-muted-foreground">Please sign in to access your boards</p>
          <button 
            class="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
            onclick={() => showLoginSheet = true}
          >
            Sign In
          </button>
        </div>
      </div>
    {/if}
  </main>
  
  <!-- Auth Modals -->
  <LoginSheet 
    open={showLoginSheet} 
    onClose={() => showLoginSheet = false}
  />
  
  <ProfileEditor
    open={showProfileEditor}
    onClose={() => showProfileEditor = false}
  />
</div>