# Nostr-Benutzerauthentifizierung & Profilverwaltung

**Datum:** 18. Oktober 2025  
**Projekt:** Nostr-basiertes KI-Kanban-Board  
**Framework:** Svelte 5, NDK, TypeScript

---

## Executive Summary

Die Benutzerauthentifizierung ist das **Fundament** für alle Nostr-Operationen. Ohne authentifizierten Benutzer können keine Events signiert und publiziert werden. Dieses Dokument spezifiziert die vollständige Implementierung der Authentifizierungs- und Profilverwaltungskomponenten.

### Schlüssel-Features

- **Multi-Method Authentication:** NIP-07, nsec, NIP-46
- **Session-Persistenz:** Sichere Speicherung in IndexedDB
- **Profilverwaltung:** Kind 0 Events, NIP-05 Verifikation
- **Security-First:** Keine Private Keys im localStorage

---

## I. Authentifizierungs-Architektur

### 1.1 Authentifizierungs-Flow

```
┌─────────────────────────────────┐
│  App Startup                    │
└────────────┬────────────────────┘
             ↓
        ┌─────────────────┐
        │ User angemeldet?│
        └────┬────────────┘
             │
    Nein    │    Ja
    ┌───────┴────────┐
    ↓                ↓
┌─────────────┐  ┌──────────────────┐
│ Login Sheet │  │ App laden        │
│ (Modal)     │  │ (User im Header) │
└─────────────┘  └──────────────────┘
    ↓
┌─────────────────────────────────┐
│ 3 Authentifizierungs-Optionen: │
│ 1. Browser Extension (NIP-07)   │
│ 2. nsec eingeben (Development)  │
│ 3. NIP-46 Connect (Wallets)     │
└─────────────────────────────────┘
```

### 1.2 Unterstützte Signer

| Signer-Typ | Status | Use Case | Security Level |
|------------|--------|----------|----------------|
| **NIP-07** | ✅ Primary | Browser Extensions (Alby, nos2x) | 🟢 Hoch |
| **Private Key** | ⚠️ Development | Testing & Development | 🔴 Niedrig |
| **NIP-46** | 🟡 Geplant | Remote Wallets | 🟢 Hoch |
| **Hardware** | 🔄 Future | Hardware Wallets | 🟢 Sehr Hoch |

---

## II. Core Implementation

### 2.1 AuthStore (Session Management)

**Datei:** `src/lib/stores/authStore.ts`

```typescript
import { persisted } from 'svelte-persisted-store';
import { NDKNip07Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import type NDK from '@nostr-dev-kit/ndk';
import type { NDKUser } from '@nostr-dev-kit/ndk';

// Session Data Interface
export interface UserSession {
  pubkey: string;
  npub: string;
  profile: {
    name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    lud16?: string;
  };
  signerType: 'nip07' | 'nsec' | 'nip46';
  lastLogin: number;
  expires: number; // 7 Tage
}

// Auth State (Svelte 5 Runes)
export class AuthStore {
  // Persistente Session (IndexedDB)
  private sessionStore = persisted<UserSession | null>('nostr-user-session', null);
  
  // Reaktiver Zustand
  public currentUser = $state<NDKUser | null>(null);
  public isAuthenticated = $derived(!!this.currentUser);
  public isLoading = $state(false);
  
  constructor(private ndk: NDK) {
    // Restore session on init
    this.restoreSession();
  }
  
  /**
   * NIP-07 Browser Extension Login
   */
  public async loginWithNip07(): Promise<NDKUser> {
    try {
      this.isLoading = true;
      
      // Check if extension exists
      if (!window.nostr) {
        throw new Error('Nostr extension not found. Install Alby or nos2x.');
      }
      
      const signer = new NDKNip07Signer();
      this.ndk.signer = signer;
      
      const user = await signer.user();
      await user.fetchProfile();
      
      this.currentUser = user;
      
      // Save session
      await this.saveSession(user, 'nip07');
      
      return user;
      
    } catch (error) {
      console.error('NIP-07 login failed:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * Private Key (nsec) Login - DEVELOPMENT ONLY
   */
  public async loginWithNsec(nsec: string): Promise<NDKUser> {
    try {
      this.isLoading = true;
      
      // Validate nsec format
      if (!nsec.startsWith('nsec1') || nsec.length !== 63) {
        throw new Error('Invalid nsec format');
      }
      
      const signer = new NDKPrivateKeySigner(nsec);
      this.ndk.signer = signer;
      
      const user = await signer.user();
      await user.fetchProfile();
      
      this.currentUser = user;
      
      // Save session (WITHOUT nsec!)
      await this.saveSession(user, 'nsec');
      
      return user;
      
    } catch (error) {
      console.error('nsec login failed:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }
  
  /**
   * NIP-46 Remote Signing - FUTURE
   */
  public async loginWithNip46(connectionString: string): Promise<NDKUser> {
    // TODO: Implement NIP-46
    throw new Error('NIP-46 not yet implemented');
  }
  
  /**
   * Logout
   */
  public async logout(): Promise<void> {
    this.currentUser = null;
    this.ndk.signer = undefined;
    
    // Clear session
    this.sessionStore.set(null);
    
    console.log('🚪 User logged out');
  }
  
  /**
   * Save Session (ohne Private Keys!)
   */
  private async saveSession(user: NDKUser, signerType: 'nip07' | 'nsec' | 'nip46'): Promise<void> {
    const session: UserSession = {
      pubkey: user.pubkey,
      npub: user.npub,
      profile: {
        name: user.profile?.name,
        about: user.profile?.about,
        picture: user.profile?.picture || user.profile?.image,
        nip05: user.profile?.nip05,
        lud16: user.profile?.lud16
      },
      signerType,
      lastLogin: Date.now(),
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 Tage
    };
    
    this.sessionStore.set(session);
    console.log(`💾 Session saved for ${user.profile?.name || 'Anonymous'}`);
  }
  
  /**
   * Restore Session
   */
  private async restoreSession(): Promise<void> {
    try {
      const session = this.getStoredSession();
      if (!session) return;
      
      // Session expired?
      if (Date.now() > session.expires) {
        console.log('⏰ Session expired');
        this.sessionStore.set(null);
        return;
      }
      
      // Recreate user from session
      const user = this.ndk.getUser({ pubkey: session.pubkey });
      user.profile = session.profile;
      
      this.currentUser = user;
      
      console.log(`🔄 Session restored for ${session.profile.name || 'Anonymous'}`);
      
      // Try to restore signer (only for NIP-07)
      if (session.signerType === 'nip07' && window.nostr) {
        const signer = new NDKNip07Signer();
        this.ndk.signer = signer;
      }
      
    } catch (error) {
      console.error('Failed to restore session:', error);
      this.sessionStore.set(null);
    }
  }
  
  /**
   * Get stored session
   */
  private getStoredSession(): UserSession | null {
    // Use get() from svelte-persisted-store
    const stored = this.sessionStore;
    return stored ? JSON.parse(JSON.stringify(stored)) : null;
  }
  
  /**
   * Update Profile (Kind 0)
   */
  public async updateProfile(profileData: {
    name?: string;
    about?: string;
    picture?: string;
    nip05?: string;
    lud16?: string;
  }): Promise<void> {
    if (!this.currentUser || !this.ndk.signer) {
      throw new Error('User not authenticated');
    }
    
    try {
      // Update local profile
      if (!this.currentUser.profile) {
        this.currentUser.profile = {};
      }
      
      Object.assign(this.currentUser.profile, profileData);
      
      // Publish Kind 0 Event
      await this.currentUser.publish();
      
      // Update session
      const session = this.getStoredSession();
      if (session) {
        session.profile = { ...session.profile, ...profileData };
        this.sessionStore.set(session);
      }
      
      console.log('✅ Profile updated');
      
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  }
  
  /**
   * Verify NIP-05
   */
  public async verifyNip05(identifier: string): Promise<boolean> {
    if (!this.currentUser) return false;
    
    try {
      const [user, domain] = identifier.split('@');
      
      const response = await fetch(
        `https://${domain}/.well-known/nostr.json?name=${user}`
      );
      
      if (!response.ok) return false;
      
      const data = await response.json();
      
      return data.names[user] === this.currentUser.pubkey;
      
    } catch {
      return false;
    }
  }
  
  /**
   * Get session info for debugging
   */
  public getSessionInfo() {
    return {
      isAuthenticated: this.isAuthenticated,
      user: this.currentUser?.profile,
      session: this.getStoredSession()
    };
  }
}

// Global Auth Store Instance
export let authStore: AuthStore;

// Initialize function (call from +layout.svelte)
export function initializeAuth(ndk: NDK): AuthStore {
  authStore = new AuthStore(ndk);
  return authStore;
}
```

### 2.2 Login Sheet Component

**Datei:** `src/lib/components/auth/LoginSheet.svelte`

```svelte
<script lang="ts">
  import * as Sheet from "$lib/components/ui/sheet";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import * as Field from "$lib/components/ui/field";
  import * as Tabs from "$lib/components/ui/tabs";
  import { Badge } from "$lib/components/ui/badge";
  import { authStore } from '$lib/stores/authStore';
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
                <img src="/icons/alby.svg" alt="Alby" class="w-6 h-6" />
                <div class="flex-1">
                  <p class="font-medium">Alby</p>
                  <p class="text-xs text-muted-foreground">Lightning Wallet + Nostr</p>
                </div>
              </div>
              
              <div class="flex items-center gap-3 p-3 border rounded-lg">
                <img src="/icons/nos2x.svg" alt="nos2x" class="w-6 h-6" />
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
```

### 2.3 User Header Component

**Datei:** `src/lib/components/auth/UserHeader.svelte`

```svelte
<script lang="ts">
  import { Button } from "$lib/components/ui/button";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu";
  import { Avatar } from "@nostr-dev-kit/svelte";
  import { Badge } from "$lib/components/ui/badge";
  import { authStore } from '$lib/stores/authStore';
  import UserIcon from "@lucide/svelte/icons/user";
  import SettingsIcon from "@lucide/svelte/icons/settings";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  
  interface Props {
    onOpenProfile?: () => void;
    onOpenSettings?: () => void;
  }
  
  const { onOpenProfile, onOpenSettings }: Props = $props();
  
  // Reactive user data
  const user = $derived(authStore.currentUser);
  const isAuthenticated = $derived(authStore.isAuthenticated);
  
  async function handleLogout() {
    await authStore.logout();
  }
  
  function getDisplayName(): string {
    if (!user?.profile) return 'Anonymous';
    return user.profile.name || user.profile.display_name || 'Anonymous';
  }
  
  function getNip05(): string | null {
    return user?.profile?.nip05 || null;
  }
  
  function getAvatarUrl(): string {
    return user?.profile?.picture || user?.profile?.image || '';
  }
</script>

{#if isAuthenticated && user}
  <div class="flex items-center gap-3">
    <!-- User Info -->
    <div class="hidden sm:flex sm:items-center sm:gap-3">
      <Avatar 
        ndk={authStore.ndk}
        pubkey={user.pubkey} 
        size={32}
        class="ring-2 ring-offset-2 ring-purple-500/20"
      />
      
      <div class="hidden md:block">
        <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
          {getDisplayName()}
        </p>
        {#if getNip05()}
          <div class="flex items-center gap-1">
            <Badge variant="secondary" class="text-xs">
              ✓ {getNip05()}
            </Badge>
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Dropdown Menu -->
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild let:builder>
        <Button variant="ghost" size="sm" builders={[builder]} class="h-8 w-8 p-0 sm:hidden">
          <Avatar 
            ndk={authStore.ndk}
            pubkey={user.pubkey} 
            size={24}
          />
        </Button>
      </DropdownMenu.Trigger>
      
      <DropdownMenu.Content align="end" class="w-56">
        <DropdownMenu.Label class="font-normal">
          <div class="flex flex-col space-y-1">
            <p class="text-sm font-medium leading-none">{getDisplayName()}</p>
            <p class="text-xs leading-none text-muted-foreground">
              {user.npub.slice(0, 16)}...
            </p>
            {#if getNip05()}
              <Badge variant="secondary" class="text-xs w-fit">
                ✓ {getNip05()}
              </Badge>
            {/if}
          </div>
        </DropdownMenu.Label>
        
        <DropdownMenu.Separator />
        
        <DropdownMenu.Item onclick={() => onOpenProfile?.()}>
          <UserIcon class="mr-2 h-4 w-4" />
          Edit Profile
        </DropdownMenu.Item>
        
        <DropdownMenu.Item onclick={() => onOpenSettings?.()}>
          <SettingsIcon class="mr-2 h-4 w-4" />
          Settings
        </DropdownMenu.Item>
        
        <DropdownMenu.Separator />
        
        <DropdownMenu.Item onclick={handleLogout} class="text-red-600 focus:text-red-600">
          <LogOutIcon class="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </div>
{:else}
  <!-- Login Button for unauthenticated users -->
  <Button variant="default" size="sm">
    <KeyRoundIcon class="mr-2 h-4 w-4" />
    Sign In
  </Button>
{/if}
```

### 2.4 Profile Editor Component

**Datei:** `src/lib/components/auth/ProfileEditor.svelte`

```svelte
<script lang="ts">
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Sheet from "$lib/components/ui/sheet";
  import * as Field from "$lib/components/ui/field";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Textarea } from "$lib/components/ui/textarea";
  import { Badge } from "$lib/components/ui/badge";
  import { authStore } from '$lib/stores/authStore';
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
    // Reset form
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
        <Field.Error errors={errors.name ? [{ message: errors.name }] : undefined} />
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
        <Field.Error errors={errors.about ? [{ message: errors.about }] : undefined} />
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
        <Field.Error errors={errors.picture ? [{ message: errors.picture }] : undefined} />
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
        <Field.Error errors={errors.nip05 ? [{ message: errors.nip05 }] : undefined} />
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
        <Field.Error errors={errors.lud16 ? [{ message: errors.lud16 }] : undefined} />
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

---

## III. Integration in Layout

### 3.1 Erweiterte Layout-Datei

**Datei:** `src/routes/+layout.svelte` (Erweitert)

```svelte
<script lang="ts">
  import "../app.css";
  import { createReactivePool } from "@nostr-dev-kit/svelte/stores";
  import { NDKSvelte } from "@nostr-dev-kit/svelte";
  import { initializeAuth } from '$lib/stores/authStore';
  import { setContext } from 'svelte';
  
  import LoginSheet from '$lib/components/auth/LoginSheet.svelte';
  import UserHeader from '$lib/components/auth/UserHeader.svelte';
  import ProfileEditor from '$lib/components/auth/ProfileEditor.svelte';
  import { Button } from "$lib/components/ui/button";
  import KeyRoundIcon from "@lucide/svelte/icons/key-round";

  interface Props {
    children?: any;
  }

  const { children } = $props();

  // NDK Setup
  const ndk = new NDKSvelte({
    explicitRelayUrls: [
      "wss://relay.damus.io",
      "wss://relay.primal.net",
      "wss://nos.lol",
    ],
  });

  const pool = createReactivePool(ndk);
  ndk.connect();
  
  // Initialize Auth Store
  const authStore = initializeAuth(ndk);
  
  // UI State
  let showLoginSheet = $state(false);
  let showProfileEditor = $state(false);
  
  // Auto-show login if not authenticated
  $effect(() => {
    if (!authStore.isAuthenticated && !showLoginSheet) {
      // Delay to allow session restore
      setTimeout(() => {
        if (!authStore.isAuthenticated) {
          showLoginSheet = true;
        }
      }, 1000);
    }
  });
  
  // Context for child components
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
  <main class="container py-6">
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
```

---

## IV. Security Checkliste

### 4.1 Kritische Security-Maßnahmen

| Bereich | Maßnahme | Status | Implementierung |
|---------|----------|--------|-----------------|
| **Private Keys** | ❌ Niemals nsec speichern | ✅ | AuthStore speichert nur pubkey |
| **Session** | ✅ Sichere Session-Verwaltung | ✅ | IndexedDB + Expiration |
| **HTTPS** | ✅ Nur HTTPS in Production | ⚠️ | Deployment-konfiguration |
| **CSP Headers** | ✅ Content Security Policy | ❌ | Server-Konfiguration |
| **Extension Check** | ✅ Nostr Extension Validierung | ✅ | window.nostr Check |
| **URL Validation** | ✅ Profile Picture URLs prüfen | ✅ | Zod Schema |
| **Rate Limiting** | ✅ API Rate Limits | ❌ | Relay-abhängig |

### 4.2 Implementierungs-Details

#### Private Key Schutz

```typescript
// ✅ RICHTIG: Nur pubkey speichern
const session: UserSession = {
  pubkey: user.pubkey,
  npub: user.npub,
  // ❌ NIEMALS: nsec hier speichern!
};

// ✅ RICHTIG: nsec nur temporär im Speicher
const signer = new NDKPrivateKeySigner(nsec);
// nsec wird nach Signer-Erstellung verworfen
```

#### Session Security

```typescript
// ✅ Session Expiration (7 Tage)
expires: Date.now() + (7 * 24 * 60 * 60 * 1000)

// ✅ Automatic Session Cleanup
if (Date.now() > session.expires) {
  this.sessionStore.set(null);
  return;
}
```

#### Content Security Policy

```html
<!-- In app.html -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  connect-src 'self' wss://*.relay.damus.io wss://*.primal.net wss://*.nos.lol;
  img-src 'self' https: data:;
  style-src 'self' 'unsafe-inline';
">
```

#### URL Validation

```typescript
// ✅ Validate Profile Picture URLs
const profileSchema = z.object({
  picture: z.string().url("Invalid image URL").optional().or(z.literal(""))
});

// ✅ Sanitize vor Display
function sanitizeImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return '';
    return url;
  } catch {
    return '';
  }
}
```

### 4.3 Production Deployment Checklist

```markdown
## Pre-Deployment Security Check

- [ ] ✅ Alle nsec-Eingaben nur in Development Mode
- [ ] ✅ HTTPS enforced (kein HTTP in Production)
- [ ] ✅ CSP Headers konfiguriert
- [ ] ✅ No console.log mit sensiblen Daten
- [ ] ✅ Error Messages enthalten keine Private Keys
- [ ] ✅ Session Expiration getestet
- [ ] ✅ Logout funktioniert vollständig
- [ ] ✅ NIP-07 Extension Check funktioniert
- [ ] ✅ Profile Picture URLs werden validiert
- [ ] ✅ NIP-05 Verifikation funktioniert

## Environment Variables

```bash
# .env.production
PUBLIC_NOSTR_RELAYS="wss://relay.damus.io,wss://relay.primal.net"
PUBLIC_APP_ENVIRONMENT="production"
PUBLIC_ENABLE_NSEC_LOGIN="false"  # Disable in production!
```

---

## V. Testing & Quality Assurance

### 5.1 Unit Tests

**Datei:** `src/lib/stores/authStore.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthStore } from './authStore';
import { NDKSvelte } from '@nostr-dev-kit/ndk';

describe('AuthStore', () => {
  let authStore: AuthStore;
  let mockNDK: NDKSvelte;
  
  beforeEach(() => {
    mockNDK = new NDKSvelte({});
    authStore = new AuthStore(mockNDK);
  });
  
  it('should initialize with no user', () => {
    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.currentUser).toBe(null);
  });
  
  it('should handle NIP-07 login', async () => {
    // Mock window.nostr
    global.window = {
      nostr: {
        getPublicKey: vi.fn().mockResolvedValue('pubkey123'),
        signEvent: vi.fn()
      }
    } as any;
    
    const user = await authStore.loginWithNip07();
    
    expect(authStore.isAuthenticated).toBe(true);
    expect(user.pubkey).toBe('pubkey123');
  });
  
  it('should reject invalid nsec', async () => {
    await expect(authStore.loginWithNsec('invalid')).rejects.toThrow('Invalid nsec format');
  });
  
  it('should handle logout', async () => {
    // Setup authenticated user
    await authStore.loginWithNsec('nsec1...');
    
    await authStore.logout();
    
    expect(authStore.isAuthenticated).toBe(false);
    expect(authStore.currentUser).toBe(null);
  });
});
```

### 5.2 E2E Tests

**Datei:** `tests/auth.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should show login sheet on first visit', async ({ page }) => {
    await page.goto('/');
    
    // Should show login sheet
    await expect(page.locator('[data-testid="login-sheet"]')).toBeVisible();
  });
  
  test('should handle NIP-07 login', async ({ page }) => {
    // Mock Nostr extension
    await page.addInitScript(() => {
      (window as any).nostr = {
        getPublicKey: () => Promise.resolve('mock-pubkey'),
        signEvent: (event: any) => Promise.resolve({ ...event, sig: 'mock-sig' })
      };
    });
    
    await page.goto('/');
    
    // Click NIP-07 login
    await page.click('[data-testid="nip07-login"]');
    
    // Should be authenticated
    await expect(page.locator('[data-testid="user-header"]')).toBeVisible();
  });
  
  test('should handle profile editing', async ({ page, context }) => {
    // Login first
    await context.addInitScript(() => {
      localStorage.setItem('nostr-user-session', JSON.stringify({
        pubkey: 'test-pubkey',
        npub: 'npub1test',
        profile: { name: 'Test User' },
        signerType: 'nip07',
        expires: Date.now() + 86400000
      }));
    });
    
    await page.goto('/');
    
    // Open profile editor
    await page.click('[data-testid="user-menu"]');
    await page.click('text=Edit Profile');
    
    // Edit name
    await page.fill('[data-testid="profile-name"]', 'Updated Name');
    await page.click('[data-testid="save-profile"]');
    
    // Should show updated name
    await expect(page.locator('text=Updated Name')).toBeVisible();
  });
});
```

---

## VI. Monitoring & Analytics

### 6.1 Auth Events Tracking

```typescript
// In AuthStore
private trackAuthEvent(event: 'login' | 'logout' | 'session_restore', method?: string) {
  // Only in production with user consent
  if (import.meta.env.PROD) {
    console.log(`Auth Event: ${event}${method ? ` (${method})` : ''}`);
    
    // Optional: Send to analytics
    // analytics.track('auth_event', { event, method });
  }
}

// Usage
await this.loginWithNip07();
this.trackAuthEvent('login', 'nip07');
```

### 6.2 Error Monitoring

```typescript
// Error logging with context
private logAuthError(error: Error, context: string) {
  console.error(`Auth Error [${context}]:`, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent
  });
  
  // Optional: Send to error tracking
  // errorTracking.captureException(error, { context });
}
```

---

## VII. Migration Guide

### 7.1 Von bestehender Auth zu neuer Implementation

```typescript
// Migration script for existing users
export async function migrateAuthData() {
  // Check for old auth data
  const oldSession = localStorage.getItem('old-auth-key');
  if (!oldSession) return;
  
  try {
    const oldData = JSON.parse(oldSession);
    
    // Convert to new format
    const newSession: UserSession = {
      pubkey: oldData.pubkey,
      npub: oldData.npub || convertToNpub(oldData.pubkey),
      profile: oldData.profile || {},
      signerType: 'nip07', // Assume NIP-07
      lastLogin: Date.now(),
      expires: Date.now() + (7 * 24 * 60 * 60 * 1000)
    };
    
    // Save in new format
    const authStore = new AuthStore(ndk);
    authStore.sessionStore.set(newSession);
    
    // Clean up old data
    localStorage.removeItem('old-auth-key');
    
    console.log('✅ Auth data migrated successfully');
    
  } catch (error) {
    console.error('❌ Auth migration failed:', error);
  }
}
```

---

## VIII. Roadmap & Future Features

### 8.1 Phase 1: Core Authentication (✅ Current)

- [x] NIP-07 Browser Extension Support
- [x] nsec Private Key Login (Development)
- [x] Session Management
- [x] Profile Editing (Kind 0)
- [x] NIP-05 Verification

### 8.2 Phase 2: Advanced Features (🔄 In Progress)

- [ ] NIP-46 Remote Signing
- [ ] Multi-Account Support
- [ ] Profile Picture Upload (NIP-94/NIP-96)
- [ ] Lightning Integration (NIP-57 Zaps)
- [ ] Contact Lists (NIP-02)

### 8.3 Phase 3: Enterprise Features (📋 Planned)

- [ ] Team Management
- [ ] Org-wide Authentication
- [ ] SSO Integration
- [ ] Audit Logging
- [ ] Advanced Permissions

---

## IX. Troubleshooting

### 9.1 Common Issues

#### "Extension not found"

```typescript
// Check extension availability
if (!window.nostr) {
  // Suggest extension installation
  const userAgent = navigator.userAgent;
  const isMobile = /Mobile|Android|iPhone/i.test(userAgent);
  
  if (isMobile) {
    // Mobile: Suggest mobile apps
    window.open('https://damus.io/', '_blank');
  } else {
    // Desktop: Suggest browser extension
    window.open('https://getalby.com/', '_blank');
  }
}
```

#### "Session expired"

```typescript
// Graceful session expiration handling
private async handleExpiredSession() {
  await this.logout();
  
  // Show notification
  toast.info('Your session has expired. Please sign in again.');
  
  // Redirect to login
  showLoginSheet = true;
}
```

#### "Profile update failed"

```typescript
// Retry mechanism for profile updates
async updateProfileWithRetry(profileData: any, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await this.updateProfile(profileData);
      return; // Success
    } catch (error) {
      if (attempt === maxRetries) {
        throw error; // Final attempt failed
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

---

## X. Ressourcen & Dokumentation

### 10.1 Externe Referenzen

**[Complete Authentification Flow with NIP-07, nsec and NIP-46](https://nostr-dev-kit.github.io/ndk/cookbook/svelte5/basic-authentication.html)**

- **[NIP-07: Browser Extension Auth](https://github.com/nostr-protocol/nips/blob/master/07.md)**
- **[NIP-46: Remote Signing](https://github.com/nostr-protocol/nips/blob/master/46.md)**
- **[NIP-05: Internet Identifier](https://github.com/nostr-protocol/nips/blob/master/05.md)**
- **[NDK Authentication Guide](https://nostr-dev-kit.github.io/ndk/cookbook/)**
- **[Alby Extension](https://getalby.com/)**

### 10.2 Interne Dokumentation

- **[AGENTS.md](./AGENTS.md)** - Haupt-Spezifikation
- **[NDK.md](./NDK.md)** - NDK Integration
- **[CODE-ANALYSE.md](./CODE-ANALYSE.md)** - Status-Analyse
- **[UX-RULES.md](./UX-RULES.md)** - UI/UX Design Regeln

---

## XI. UX-RULES Compliance ✅

Diese Spezifikation wurde entsprechend der **[UX-RULES.md](./UX-RULES.md)** aktualisiert:

### ✅ Eingehaltene Regeln

| Regel | Beschreibung | Status |
|-------|-------------|--------|
| **Regel 1** | Verwendung von shadcn-svelte Komponenten | ✅ Alle Komponenten verwenden `$lib/components/ui/*` |
| **Regel 5** | Button-Größen konsistent | ✅ `size="sm"` für Topbar, `size="default"` für Primär-Aktionen |
| **Regel 6** | Icons links vom Text | ✅ Alle Buttons mit `class="mr-2 h-4 w-4"` |
| **Regel 8-10** | Card-Struktur | ✅ `Card.Root`, `Card.Header`, `Card.Content`, `Card.Footer` |
| **Regel 11-17** | Field-Struktur | ✅ `Field.Root`, `Field.Label`, `Field.Content`, `Field.Error` |
| **Regel 18-24** | Dialog-Struktur | ✅ Vollständige Dialog-Hierarchie verwendet |
| **Icon-Regel** | Lucide Icons statt Emojis | ✅ `lucide-svelte/icons/*` importiert |

### ✅ Korrigierte Verstöße

1. **Emojis → Lucide Icons**: 🔑 → `<KeyRoundIcon />`, 👤 → `<UserIcon />`, etc.
2. **Formular-Struktur**: Alle Eingabefelder verwenden jetzt `<Field.Root>` Container
3. **Button-Komponenten**: Alle `<button>` Tags durch `<Button>` ersetzt
4. **Konsistente Ladezustände**: `LoaderIcon` mit `animate-spin` statt Custom CSS

### 📋 Implementierungs-Hinweise

- **Icon-Import-Pattern**: `import IconName from "@lucide/svelte/icons/icon-name"` (⚠️ **NICHT** `lucide-svelte/icons/`)
- **Formular-Pattern**: Immer `Field.Root > Field.Label + Field.Content + Field.Error`
- **Dialog-Pattern**: Immer `Dialog.Root > Dialog.Content > Dialog.Header + Content + Dialog.Footer`
- **Button-Varianten**: `default` für Primär, `outline` für Sekundär, `ghost` für Tertär

### ⚠️ WICHTIGER HINWEIS: Icon-Import-Syntax

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

**Ende der NOSTR-USER.md Spezifikation**