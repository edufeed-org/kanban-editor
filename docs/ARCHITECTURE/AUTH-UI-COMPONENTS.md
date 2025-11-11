# Nostr Authentication UI Components

**Datum:** 29. Oktober 2025  
**Projekt:** Nostr-basiertes KI-Kanban-Board  
**Framework:** Svelte 5, shadcn-svelte, NDK

---

## 📋 Übersicht

Diese Dokumentation beschreibt die **UI-Komponenten** für die Nostr-Authentifizierung. Für die Store-Logik siehe **[STORES/AUTHSTORE.md](./STORES/AUTHSTORE.md)**.

### Komponenten-Übersicht

| Komponente | Datei | Zweck | Status |
|------------|-------|-------|--------|
| **LoginSheet** | `src/lib/components/auth/LoginSheet.svelte` | Login-Modal mit 3 Methoden (Bibliothek) | ✅ Implementiert |
| **LoginDialog** | `src/routes/cardsboard/LoginDialog.svelte` | Login-Dialog (Kanban-Board spezifisch) | ✅ Implementiert |
| **LeftSidebarFooter** | `src/routes/cardsboard/LeftSidebarFooter.svelte` | User-Anzeige in Sidebar mit Login/Logout | ✅ Implementiert |
| **ProfileEditor** | `src/lib/components/auth/ProfileEditor.svelte` | Profil-Bearbeitung (Kind 0) | ✅ Implementiert |

**Wichtig:** Es gibt zwei Login-Komponenten:
- **LoginSheet**: Generische Bibliotheks-Komponente (Sheet-basiert)
- **LoginDialog**: Kanban-Board spezifische Variante (Dialog-basiert)

Beide verwenden **AuthStore** für die Authentifizierung.

---

## 🎯 LoginSheet Component

### Zweck

Modal-Dialog für Benutzerauthentifizierung mit 3 Login-Methoden:
1. **NIP-07** Browser Extension (Production)
2. **nsec** Private Key (Development ONLY)
3. **NIP-46** Remote Signing (Future)

### Implementation

**Datei:** `src/lib/components/auth/LoginSheet.svelte`

```svelte
<script lang="ts">
  import * as Sheet from "$lib/components/ui/sheet";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Field from "$lib/components/ui/field";
  import * as Tabs from "$lib/components/ui/tabs";
  import { Badge } from "$lib/components/ui/badge";
  import { authStore } from '$lib/stores/authStore.svelte';
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";
  import ShieldCheckIcon from "@lucide/svelte/icons/shield-check";
  import WifiOffIcon from "@lucide/svelte/icons/wifi-off";
  
  interface Props {
    open: boolean;
    onClose: () => void;
  }
  
  const { open, onClose }: Props = $props();
  
  // State
  let nsecInput = $state('');
  let nip46Input = $state('');
  let isLoading = $state(false);
  let error = $state<string | null>(null);
  let activeTab = $state('extension');
  
  // Methods
  async function handleNip07Login() {
    try {
      error = null;
      isLoading = true;
      
      await authStore.loginWithNip07();
      onClose();
      
    } catch (err: any) {
      error = err.message;
      
      if (err.message.includes('extension not found')) {
        // Redirect to extension installation
        window.open('https://getalby.com/', '_blank');
      }
    } finally {
      isLoading = false;
    }
  }
  
  async function handleNsecLogin() {
    try {
      error = null;
      isLoading = true;
      
      await authStore.loginWithNsec(nsecInput);
      onClose();
      
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
      
      await authStore.loginWithNip46(nip46Input);
      onClose();
      
    } catch (err: any) {
      error = err.message;
    } finally {
      isLoading = false;
    }
  }
  
  // Clear error when tab changes
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
                <ShieldCheckIcon class="w-6 h-6 text-purple-600" />
                <div class="flex-1">
                  <p class="font-medium">Alby</p>
                  <p class="text-xs text-muted-foreground">Lightning Wallet + Nostr</p>
                </div>
              </div>
              
              <div class="flex items-center gap-3 p-3 border rounded-lg">
                <ShieldCheckIcon class="w-6 h-6 text-blue-600" />
                <div class="flex-1">
                  <p class="font-medium">nos2x</p>
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
            
            <p class="text-xs text-center text-muted-foreground">
              Don't have an extension? 
              <a href="https://getalby.com/" target="_blank" class="text-blue-600 hover:underline">
                Install Alby
              </a>
            </p>
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
            
            <Field.Root>
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
            </Field.Root>
            
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
            
            <Field.Root>
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
            </Field.Root>
            
            <Button disabled class="w-full" variant="outline">
              <WifiOffIcon class="mr-2 h-4 w-4" />
              Connect Wallet (Not Available)
            </Button>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  </Sheet.Content>
</Sheet.Root>
```

### Verwendung

```svelte
<script lang="ts">
  import LoginSheet from '$lib/components/auth/LoginSheet.svelte';
  
  let showLogin = $state(false);
</script>

<Button onclick={() => showLogin = true}>Sign In</Button>

<LoginSheet open={showLogin} onClose={() => showLogin = false} />
```

### UX-Features

- ✅ Tab-Navigation zwischen 3 Methoden
- ✅ Loading-States mit Spinner
- ✅ Error-Display
- ✅ Extension-Installation-Link
- ✅ Development-Warning für nsec
- ✅ Disabled-State für NIP-46 (Coming Soon)

---

## ✏️ ProfileEditor Component

### Zweck

Dialog zum Bearbeiten des Nostr-Profils (Kind 0 Event).

### Implementation

**Datei:** `src/lib/components/auth/ProfileEditor.svelte`

```svelte
<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Field from "$lib/components/ui/field";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Badge } from "$lib/components/ui/badge";
  import { authStore } from '$lib/stores/authStore.svelte';
  import { z } from "zod";
  import CheckCircleIcon from "@lucide/svelte/icons/check-circle";
  import XCircleIcon from "@lucide/svelte/icons/x-circle";
  import LoaderIcon from "@lucide/svelte/icons/loader";
  
  interface Props {
    open: boolean;
    onClose: () => void;
  }
  
  const { open, onClose }: Props = $props();
  
  // Validation Schema
  const profileSchema = z.object({
    name: z.string().min(1, "Name is required").max(50, "Name too long"),
    about: z.string().max(500, "About section too long").optional(),
    picture: z.string().url("Invalid image URL").optional().or(z.literal("")),
    nip05: z.string().email("Invalid NIP-05 identifier").optional().or(z.literal("")),
    lud16: z.string().email("Invalid Lightning Address").optional().or(z.literal(""))
  });
  
  // Form State
  let formData = $state({
    name: '',
    about: '',
    picture: '',
    nip05: '',
    lud16: ''
  });
  
  let errors = $state<Record<string, string>>({});
  let isSubmitting = $state(false);
  let isVerifyingNip05 = $state(false);
  let nip05Verified = $state<boolean | null>(null);
  
  // Load current profile data when dialog opens
  $effect(() => {
    if (open && authStore.currentUser?.profile) {
      const profile = authStore.currentUser.profile;
      formData = {
        name: profile.name || '',
        about: profile.about || '',
        picture: profile.picture || profile.image || '',
        nip05: profile.nip05 || '',
        lud16: profile.lud16 || ''
      };
    }
  });
  
  // Verify NIP-05 when field changes
  $effect(() => {
    if (formData.nip05 && formData.nip05 !== authStore.currentUser?.profile?.nip05) {
      verifyNip05Delayed();
    } else if (!formData.nip05) {
      nip05Verified = null;
    }
  });
  
  let verifyTimeout: NodeJS.Timeout;
  function verifyNip05Delayed() {
    clearTimeout(verifyTimeout);
    nip05Verified = null;
    
    verifyTimeout = setTimeout(async () => {
      if (!formData.nip05) return;
      
      try {
        isVerifyingNip05 = true;
        nip05Verified = await authStore.verifyNip05(formData.nip05);
      } catch {
        nip05Verified = false;
      } finally {
        isVerifyingNip05 = false;
      }
    }, 1000);
  }
  
  async function handleSubmit(event: Event) {
    event.preventDefault();
    
    // Validate form
    const result = profileSchema.safeParse(formData);
    if (!result.success) {
      errors = {};
      result.error.errors.forEach(err => {
        if (err.path[0]) {
          errors[err.path[0] as string] = err.message;
        }
      });
      return;
    }
    
    try {
      isSubmitting = true;
      errors = {};
      
      // Update profile
      await authStore.updateProfile({
        name: formData.name,
        about: formData.about || undefined,
        picture: formData.picture || undefined,
        nip05: formData.nip05 || undefined,
        lud16: formData.lud16 || undefined
      });
      
      onClose();
      
    } catch (error: any) {
      errors = { submit: error.message || 'Failed to update profile' };
    } finally {
      isSubmitting = false;
    }
  }
  
  function handleCancel() {
    formData = {
      name: '',
      about: '',
      picture: '',
      nip05: '',
      lud16: ''
    };
    errors = {};
    nip05Verified = null;
    onClose();
  }
</script>

<Dialog.Root {open} onOpenChange={(newOpen) => !newOpen && handleCancel()}>
  <Dialog.Content class="sm:max-w-md">
    <Dialog.Header>
      <Dialog.Title>Edit Profile</Dialog.Title>
      <Dialog.Description>
        Update your Nostr profile information. Changes will be published to the network.
      </Dialog.Description>
    </Dialog.Header>
    
    <form onsubmit={handleSubmit} class="space-y-4">
      <!-- Display Name -->
      <Field.Root>
        <Field.Label for="name">Display Name *</Field.Label>
        <Field.Content>
          <Input
            id="name"
            bind:value={formData.name}
            disabled={isSubmitting}
            placeholder="Your name"
            aria-invalid={!!errors.name}
          />
        </Field.Content>
        {#if errors.name}
          <Field.Error>{errors.name}</Field.Error>
        {/if}
      </Field.Root>
      
      <!-- About -->
      <Field.Root>
        <Field.Label for="about">About</Field.Label>
        <Field.Content>
          <Textarea
            id="about"
            bind:value={formData.about}
            disabled={isSubmitting}
            placeholder="Tell others about yourself..."
            rows={3}
            aria-invalid={!!errors.about}
          />
        </Field.Content>
        {#if errors.about}
          <Field.Error>{errors.about}</Field.Error>
        {/if}
      </Field.Root>
      
      <!-- Profile Picture -->
      <Field.Root>
        <Field.Label for="picture">Profile Picture URL</Field.Label>
        <Field.Content>
          <Input
            id="picture"
            type="url"
            bind:value={formData.picture}
            disabled={isSubmitting}
            placeholder="https://example.com/avatar.jpg"
            aria-invalid={!!errors.picture}
          />
        </Field.Content>
        {#if errors.picture}
          <Field.Error>{errors.picture}</Field.Error>
        {/if}
      </Field.Root>
      
      <!-- NIP-05 Identifier -->
      <Field.Root>
        <Field.Label for="nip05" class="flex items-center gap-2">
          NIP-05 Identifier
          {#if isVerifyingNip05}
            <LoaderIcon class="h-3 w-3 animate-spin text-blue-600" />
          {:else if nip05Verified === true}
            <Badge variant="secondary" class="text-xs">
              <CheckCircleIcon class="mr-1 h-3 w-3" />
              Verified
            </Badge>
          {:else if nip05Verified === false}
            <Badge variant="destructive" class="text-xs">
              <XCircleIcon class="mr-1 h-3 w-3" />
              Invalid
            </Badge>
          {/if}
        </Field.Label>
        <Field.Content>
          <Input
            id="nip05"
            type="email"
            bind:value={formData.nip05}
            disabled={isSubmitting}
            placeholder="you@example.com"
            aria-invalid={!!errors.nip05}
          />
        </Field.Content>
        {#if errors.nip05}
          <Field.Error>{errors.nip05}</Field.Error>
        {/if}
        <Field.Description>
          For identity verification. Must be configured by domain owner.
        </Field.Description>
      </Field.Root>
      
      <!-- Lightning Address -->
      <Field.Root>
        <Field.Label for="lud16">Lightning Address (LUD-16)</Field.Label>
        <Field.Content>
          <Input
            id="lud16"
            type="email"
            bind:value={formData.lud16}
            disabled={isSubmitting}
            placeholder="you@wallet.example.com"
            aria-invalid={!!errors.lud16}
          />
        </Field.Content>
        {#if errors.lud16}
          <Field.Error>{errors.lud16}</Field.Error>
        {/if}
        <Field.Description>
          For receiving Lightning payments (zaps).
        </Field.Description>
      </Field.Root>
      
      <!-- Submit Error -->
      {#if errors.submit}
        <div class="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-600 dark:text-red-400">{errors.submit}</p>
        </div>
      {/if}
      
      <!-- Buttons -->
      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={handleCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || Object.keys(errors).length > 0}>
          {#if isSubmitting}
            <LoaderIcon class="mr-2 h-4 w-4 animate-spin" />
          {/if}
          Save Changes
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
```

### Verwendung

```svelte
<script lang="ts">
  import ProfileEditor from '$lib/components/auth/ProfileEditor.svelte';
  
  let showProfile = $state(false);
</script>

<Button onclick={() => showProfile = true}>Edit Profile</Button>

<ProfileEditor open={showProfile} onClose={() => showProfile = false} />
```

### UX-Features

- ✅ Form-Validation mit Zod
- ✅ Real-Time NIP-05 Verifikation
- ✅ Live Badge-Update (Verified/Invalid)
- ✅ Loading-States
- ✅ Error-Display per Field
- ✅ Disabled-State während Submit

---

## 🔗 Integration in Layout

### Vollständiges Beispiel

**Datei:** `src/routes/+layout.svelte`

```svelte
<script lang="ts">
  import "../app.css";
  import NDK from '@nostr-dev-kit/ndk';
  import { initializeAuth } from '$lib/stores/authStore.svelte';
  import { settingsStore } from '$lib/stores/settingsStore.svelte';
  import { setContext, onMount } from 'svelte';
  
  import LoginSheet from '$lib/components/auth/LoginSheet.svelte';
  import UserHeader from '$lib/components/auth/UserHeader.svelte';
  import ProfileEditor from '$lib/components/auth/ProfileEditor.svelte';
  
  let showLogin = $state(false);
  let showProfile = $state(false);
  let authStore: ReturnType<typeof initializeAuth>;
  
  onMount(async () => {
    // 1. Config laden
    await settingsStore.loadAndCacheConfig();
    
    // 2. NDK initialisieren
    const ndk = new NDK({
      explicitRelayUrls: settingsStore.settings.relaysPublic
    });
    await ndk.connect();
    
    // 3. AuthStore initialisieren
    authStore = initializeAuth(ndk);
    setContext('authStore', authStore);
    
    // 4. Check ob User eingeloggt
    if (!authStore.isAuthenticated) {
      showLogin = true;
    }
  });
</script>

<div class="min-h-screen bg-background">
  <!-- Top Navigation -->
  <header class="border-b">
    <div class="container mx-auto px-4 py-3 flex items-center justify-between">
      <h1 class="text-xl font-bold">Kanban Board</h1>
      
      <!-- User Header (rechts) -->
      <UserHeader 
        onOpenProfile={() => showProfile = true}
        onOpenLogin={() => showLogin = true}
      />
    </div>
  </header>
  
  <!-- Main Content -->
  <main>
    <slot />
  </main>
  
  <!-- Dialogs -->
  <LoginSheet open={showLogin} onClose={() => showLogin = false} />
  <ProfileEditor open={showProfile} onClose={() => showProfile = false} />
</div>
```

---

## �️ LoginDialog Component (Kanban-Board spezifisch)

### Zweck

Dialog-basierte Login-Komponente für das Kanban-Board. Verwendet **Dialog** statt Sheet für kompaktere Darstellung.

**Datei:** `src/routes/cardsboard/LoginDialog.svelte`

### Implementation

```svelte
<script lang="ts">
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

  async function handleNsecLogin() {
    const success = await authStore.loginWithNsec(nsecInput);
    if (success) {
      open = false;
      nsecInput = '';
    }
  }

  async function handleNip07Login() {
    const success = await authStore.loginWithNip07();
    if (success) {
      open = false;
      location.reload(); // Profile kommt verzögert
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

    <Tabs value="nip07" class="w-full">
      <TabsList class="grid w-full grid-cols-3">
        <TabsTrigger value="nip07" title="NIP07">
          <LogInIcon class="h-4 w-4 mr-2" />
          NIP-07
        </TabsTrigger>
        <TabsTrigger value="nsec" title="NSEC">
          <KeyRoundIcon class="h-4 w-4 mr-2" />
          nsec
        </TabsTrigger>
        <TabsTrigger value="nip46" disabled title="WIP">
          <UserIcon class="h-4 w-4 mr-2" />
          NIP-46
        </TabsTrigger>
      </TabsList>

      <!-- NIP-07 TAB -->
      <TabsContent value="nip07" class="space-y-4">
        <p class="text-sm text-muted-foreground">
          Verbinde dich mit einer Browser-Extension wie Alby oder nos2x.
        </p>

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

      <!-- NSEC TAB -->
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

      <!-- NIP-46 TAB (WIP) -->
      <TabsContent value="nip46" class="space-y-4">
        <p class="text-sm text-muted-foreground">
          Remote Signer (NIP-46) — Noch nicht implementiert
        </p>
      </TabsContent>
    </Tabs>

    <Dialog.Footer class="text-xs text-muted-foreground">
      🔒 Deine Authentifizierungsdaten werden lokal gespeichert
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

### Verwendung

```svelte
<script lang="ts">
  import LoginDialog from './LoginDialog.svelte';
  
  let showLogin = $state(false);
</script>

<Button onclick={() => showLogin = true}>Login</Button>
<LoginDialog bind:open={showLogin} />
```

### Unterschiede zu LoginSheet

| Feature | LoginSheet | LoginDialog |
|---------|-----------|-------------|
| **Modal-Typ** | Sheet (Slide-in) | Dialog (Center Modal) |
| **Größe** | Full-Height | Compact (sm:max-w-md) |
| **Verwendung** | Bibliothek (generisch) | Kanban-Board spezifisch |
| **Tab-Count** | 3 Tabs (NIP-07, nsec, NIP-46) | 3 Tabs (gleich) |
| **Reload** | Kein automatischer Reload | Reload nach NIP-07 Login |

---

## 👤 LeftSidebarFooter Component

### Zweck

Benutzer-Anzeige im Footer der linken Sidebar mit Login/Logout und Demo-Session-Support.

**Datei:** `src/routes/cardsboard/LeftSidebarFooter.svelte`

### Implementation

```svelte
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Avatar from "$lib/components/ui/avatar/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { authStore } from "$lib/stores/authStore.svelte.js";
  import LoginDialog from "./LoginDialog.svelte";
  import LogInIcon from "@lucide/svelte/icons/log-in";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import PlayIcon from "@lucide/svelte/icons/play";
  import { ProfileEditor } from '$lib/components/auth/index.js';

  // Reaktive Werte
  let isAuthenticated = $derived(authStore.isAuthenticated);
  let currentUser = $derived(authStore.currentUser);
  let isDemoAllowed = $derived(authStore.isDemoSessionAllowed());

  // Dialog State
  let loginDialogOpen = $state(false);
  let showProfileEditor = $state(false);
  let demoErrorMessage = $state<string | null>(null);

  async function handleLogout() {
    authStore.logout();
    loginDialogOpen = false;
  }

  async function handleDemoSession() {
    try {
      demoErrorMessage = null;
      authStore.createDemoSession();
      console.log('✅ Demo-Session gestartet');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      demoErrorMessage = errorMsg;
      console.error('❌ Demo-Session fehler:', error);
    }
  }

  function formatPubkey(pubkey?: string): string {
    if (!pubkey) return 'Unknown';
    return `${pubkey.slice(0, 4)}...${pubkey.slice(-4)}`;
  }
</script>

<!-- User Section - sticky unten in der Sidebar -->
<div class="mt-auto pt-4 border-t border-border/40">
  {#if isAuthenticated && currentUser}
    <!-- Angemeldeter User -->
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <div class="px-3 py-3 flex items-center gap-2 hover:bg-muted/50 rounded-md cursor-pointer">
          <Avatar.Root class="h-8 w-8 flex-shrink-0">
            <Avatar.Image src="" alt={authStore.getDisplayName()} />
            <Avatar.Fallback class="{authStore.getAvatarColor()} text-white text-xs font-semibold">
              {authStore.getUserInitials()}
            </Avatar.Fallback>
          </Avatar.Root>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold truncate">{authStore.getDisplayName()}</p>
            <p class="text-xs text-muted-foreground font-mono truncate">
              {formatPubkey(currentUser.pubkey)}
            </p>
          </div>
        </div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content align="start" class="w-56">
        <!-- Settings -->
        <DropdownMenu.Item onclick={() => showProfileEditor = true} class="gap-2">
          <SettingsIcon class="h-4 w-4" />
          <span>Einstellungen</span>
        </DropdownMenu.Item>

        <!-- Logout -->
        <DropdownMenu.Item onclick={handleLogout} class="gap-2 text-destructive">
          <LogOutIcon class="h-4 w-4" />
          <span>Abmelden</span>
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {:else}
    <!-- Nicht angemeldet - Login Button -->
    <Button
      onclick={() => loginDialogOpen = true}
      variant="outline"
      class="w-full gap-2"
      size="sm"
    >
      <LogInIcon class="h-4 w-4" />
      <span>Anmelden</span>
    </Button>

    <p class="text-xs text-muted-foreground mt-3 text-center">
      Melde dich an um Karten zu erstellen
    </p>

    <!-- Demo-Button (falls erlaubt) -->
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
    {/if}
  {/if}
</div>

<!-- Dialogs -->
<LoginDialog bind:open={loginDialogOpen} />
<ProfileEditor
  open={showProfileEditor}
  onClose={() => showProfileEditor = false}
/>
```

### Verwendung in Sidebar

```svelte
<script lang="ts">
  import LeftSidebarFooter from './LeftSidebarFooter.svelte';
</script>

<!-- Sidebar Layout -->
<div class="h-full flex flex-col">
  <!-- Sidebar Content (Board-Liste, etc.) -->
  <div class="flex-1 overflow-y-auto">
    <!-- ... -->
  </div>
  
  <!-- Footer mit User-Info -->
  <LeftSidebarFooter />
</div>
```

### Features

- ✅ **Avatar mit Initialen** - `authStore.getUserInitials()` für konsistente Initialen
- ✅ **Konsistente Avatar-Farbe** - `authStore.getAvatarColor()` basiert auf Pubkey für Konsistenz
- ✅ **Display Name mit Fallback** - `authStore.getDisplayName()` zeigt Name oder "Nostr Nutzer"
- ✅ **Pubkey-Kurzform** (z.B. "0000...0001")
- ✅ **Demo-Session Support** (config-gesteuert)
- ✅ **ProfileEditor Integration** (Settings-Button)
- ✅ **LoginDialog Integration** (Login-Button)
- ✅ **Responsive** (flex-shrink-0 für Avatar)

### 🎨 Warum authStore-Methoden statt lokaler Helper?

**WICHTIG:** Die Komponente nutzt **zentrale authStore-Methoden** statt lokaler Helper-Funktionen:

```typescript
// ✅ RICHTIG - Nutze authStore für konsistente Display-Logik
{authStore.getDisplayName()}     // "Alice" oder "Nostr Nutzer"
{authStore.getUserInitials()}    // "AL" oder "NN"
{authStore.getAvatarColor()}     // "bg-blue-500" basierend auf Pubkey

// ❌ FALSCH - Dupliziere NICHT die Logik lokal
function getUserInitials(name?: string) { ... }  // Duplikat!
function getAvatarColor(name?: string) { ... }   // Duplikat!
```

**Vorteile der zentralen Logik:**
1. **Single Source of Truth** - Änderungen nur an einer Stelle
2. **Konsistente Farben** - Profil-Avatar und AvatarStack haben gleiche Farbe
3. **Bessere Wartbarkeit** - Keine duplizierten Funktionen
4. **Pubkey-basiert** - Farbe bleibt gleich auch wenn Name ändert

Siehe: **[STORES/AUTHSTORE.md](./STORES/AUTHSTORE.md)** für vollständige API-Dokumentation.

---

## �📋 UX-RULES Compliance

Alle Komponenten folgen **[UX-RULES.md](./UX-RULES.md)**:

### ✅ Eingehaltene Regeln

| Regel | Beschreibung | Status |
|-------|-------------|--------|
| **Regel 1** | shadcn-svelte Komponenten | ✅ Sheet, Dialog, Button, Input, etc. |
| **Regel 5** | Button-Größen konsistent | ✅ `size="sm"` für Header, `default` für Forms |
| **Regel 6** | Icons links vom Text | ✅ Alle Icons mit `class="mr-2 h-4 w-4"` |
| **Regel 11-17** | Field-Struktur | ✅ `Field.Root`, `Field.Label`, `Field.Content`, `Field.Error` |
| **Regel 18-24** | Dialog-Struktur | ✅ Vollständige Hierarchie |
| **Icon-Regel** | Lucide Icons | ✅ `@lucide/svelte/icons/*` Syntax |

### ⚠️ Icon-Import-Syntax (KRITISCH!)

```typescript
// ✅ RICHTIG
import KeyRoundIcon from "@lucide/svelte/icons/key-round";
import UserIcon from "@lucide/svelte/icons/user";
import SettingsIcon from "@lucide/svelte/icons/settings";

// ❌ FALSCH (funktioniert nicht!)
import KeyRoundIcon from "lucide-svelte/icons/key-round";
import { User, Settings } from "lucide-svelte";
```

---

## 🔗 Verwandte Dokumentationen

- **[STORES/AUTHSTORE.md](./STORES/AUTHSTORE.md)** — Store-Logik & API
- **[REACTIVITY.md](./REACTIVITY.md)** — Svelte 5 Runes Pattern
- **[UX-RULES.md](./UX-RULES.md)** — shadcn-svelte Guidelines
- **[NDK.md](./NDK.md)** — NDK Integration

---

**Stand:** 29. Oktober 2025  
**Maintainer:** edufeed-org/kanban-editor Team  
**Lizenz:** CC-BY-4.0
