# SIDEBAR-LOGIN - Vollständige Dokumentation

**Datum:** 25. Oktober 2025  
**Framework:** Svelte 5, TypeScript  
**Status:** ✅ Production Ready  
**Ein-Dokument-Prinzip:** ✅ Konsolidiert aus 4 Dateien

---

## I. Übersicht

Die **Sidebar-Login-Komponente** ist die zentrale UI für Benutzerauthentifizierung im Kanban-Board. Sie zeigt den aktuellen Login-Status an, ermöglicht Benutzer-Aktionen und verwaltet das User-Profil.

**Komponenten:**
- ✅ **LeftSidebarFooter** — Login/Logout UI + User-Status
- ✅ **LoginDialog** — Modal für Authentifizierung
- ✅ **Sidebar-Toggle** — Sichtbarkeits-Kontrolle (linke Sidebar)

**Integration:**
- ✅ AuthStore (Benutzer-Verwaltung)
- ✅ SettingsStore (Sidebar Visibility)
- ✅ Responsive Layout (mobile-friendly)

---

## II. Quick Start (10 Minuten)

### LeftSidebarFooter.svelte

```svelte
<script lang="ts">
  import { authStore } from '$lib/stores/authStore.svelte.js';
  import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
  import { Button } from '$lib/components/ui/button';
  import UserIcon from "@lucide/svelte/icons/user";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  
  let isAuthenticated = $derived(authStore.isAuthenticated);
  let userName = $derived(authStore.getUserName());
  let showLoginDialog = $state(false);
</script>

<!-- Footer mit User Info & Logout -->
<div class="sidebar-footer border-t p-4">
  {#if isAuthenticated}
    <div class="space-y-3">
      <div class="flex items-center gap-2">
        <UserIcon class="h-4 w-4 text-muted-foreground" />
        <span class="text-sm font-medium">{userName ?? 'User'}</span>
      </div>
      
      <Button 
        variant="outline" 
        size="sm"
        class="w-full"
        onclick={() => authStore.logout()}
      >
        <LogOutIcon class="mr-2 h-4 w-4" />
        Logout
      </Button>
    </div>
  {:else}
    <Button 
      variant="default" 
      size="sm"
      class="w-full"
      onclick={() => showLoginDialog = true}
    >
      <UserIcon class="mr-2 h-4 w-4" />
      Login
    </Button>
  {/if}
</div>

<!-- Login Dialog -->
<LoginDialog bind:open={showLoginDialog} />
```

### Sidebar Toggle (Topbar)

```svelte
<script lang="ts">
  import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
  import { Button } from '$lib/components/ui/button';
  import PanelLeftIcon from "@lucide/svelte/icons/panel-left";
  import PanelRightIcon from "@lucide/svelte/icons/panel-right";
  
  let showLeft = $derived(settingsStore.showLeftSidebar);
  let showRight = $derived(settingsStore.showRightSidebar);
</script>

<!-- Toggle Buttons -->
<div class="flex gap-2">
  <Button 
    variant="ghost" 
    size="sm"
    onclick={() => settingsStore.toggleLeftSidebar()}
  >
    <PanelLeftIcon class="h-4 w-4" />
  </Button>
  
  <Button 
    variant="ghost" 
    size="sm"
    onclick={() => settingsStore.toggleRightSidebar()}
  >
    <PanelRightIcon class="h-4 w-4" />
  </Button>
</div>
```

---

## III. Detaillierte Architektur

### 3.1 LeftSidebarFooter Komponente

**Zweck:** Benutzer-Status im Footer der linken Sidebar

**State:**
- `isAuthenticated`: Ist Benutzer angemeldet?
- `userName`: Name des aktuellen Benutzers
- `showLoginDialog`: Soll LoginDialog gezeigt werden?

**Funktionalität:**
- ✅ Zeigt User-Name an (wenn angemeldet)
- ✅ Logout Button mit Bestätigung
- ✅ Login Button (öffnet LoginDialog)
- ✅ Responsive (mobile-friendly)

**Code-Beispiel:**

```svelte
<script lang="ts">
  import { authStore } from '$lib/stores/authStore.svelte.js';
  import * as AlertDialog from "$lib/components/ui/alert-dialog";
  import { Button } from "$lib/components/ui/button";
  import UserIcon from "@lucide/svelte/icons/user";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  
  let isAuthenticated = $derived(authStore.isAuthenticated);
  let userName = $derived(authStore.getUserName());
  let showLogoutConfirm = $state(false);
  let showLoginDialog = $state(false);
  
  function handleLogout() {
    authStore.logout();
    showLogoutConfirm = false;
  }
</script>

<div class="sidebar-footer border-t p-4 space-y-2">
  
  {#if isAuthenticated}
    <!-- User Info -->
    <div class="flex items-center gap-2 px-2 py-1">
      <UserIcon class="h-4 w-4 text-muted-foreground" />
      <span class="text-sm truncate font-medium">{userName ?? 'Anonymous'}</span>
    </div>
    
    <!-- Logout Button -->
    <AlertDialog.Root open={showLogoutConfirm} onchange={(open) => showLogoutConfirm = open}>
      <AlertDialog.Trigger asChild let:builder>
        <Button 
          builders={[builder]}
          variant="outline" 
          size="sm"
          class="w-full"
        >
          <LogOutIcon class="mr-2 h-4 w-4" />
          Logout
        </Button>
      </AlertDialog.Trigger>
      
      <AlertDialog.Content>
        <AlertDialog.Header>
          <AlertDialog.Title>Logout bestätigen?</AlertDialog.Title>
        </AlertDialog.Header>
        <AlertDialog.Footer>
          <AlertDialog.Cancel>Abbrechen</AlertDialog.Cancel>
          <AlertDialog.Action onclick={handleLogout}>
            Logout
          </AlertDialog.Action>
        </AlertDialog.Footer>
      </AlertDialog.Content>
    </AlertDialog.Root>
  {:else}
    <!-- Login Button -->
    <Button 
      variant="default" 
      size="sm"
      class="w-full"
      onclick={() => showLoginDialog = true}
    >
      <UserIcon class="mr-2 h-4 w-4" />
      Mit Konto anmelden
    </Button>
  {/if}
  
</div>

<!-- Login Dialog Modal -->
<LoginDialog bind:open={showLoginDialog} />
```

### 3.2 LoginDialog Komponente

**Zweck:** Modal-Dialog für Benutzer-Authentifizierung

**Tabs:**
1. **Dummy-Tab** (Development) — Schnelle Test-User
2. **NIP-07-Tab** (Production) — Browser-Extension basiert
3. **Nsec-Tab** (WIP) — Private Key (WARNUNG: Sicherheit!)

**Code-Beispiel:**

```svelte
<script lang="ts">
  import { authStore } from '$lib/stores/authStore.svelte.js';
  import * as Dialog from "$lib/components/ui/dialog";
  import * as Tabs from "$lib/components/ui/tabs";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  
  export let open = $state(false);
  
  let dummyName = $state('Alice');
  let isLoggingIn = $state(false);
  
  async function handleDummyLogin() {
    isLoggingIn = true;
    try {
      const success = await authStore.loginWithDummy(dummyName);
      if (success) {
        open = false;
        dummyName = 'Alice'; // Reset
      }
    } finally {
      isLoggingIn = false;
    }
  }
  
  async function handleNIP07Login() {
    isLoggingIn = true;
    try {
      const success = await authStore.loginWithNIP07();
      if (success) {
        open = false;
      }
    } catch (error) {
      console.error('NIP-07 login failed:', error);
    } finally {
      isLoggingIn = false;
    }
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Mit Nostr Konto anmelden</Dialog.Title>
      <Dialog.Description>
        Wähle eine Authentifizierungs-Methode
      </Dialog.Description>
    </Dialog.Header>
    
    <Tabs.Root value="dummy">
      <!-- DUMMY TAB -->
      <Tabs.Content value="dummy" class="space-y-3">
        <p class="text-sm text-muted-foreground">
          Erstelle einen Test-User für Development
        </p>
        
        <Input 
          bind:value={dummyName}
          placeholder="Name eingeben..."
          disabled={isLoggingIn}
        />
        
        <Button 
          class="w-full"
          disabled={isLoggingIn}
          onclick={handleDummyLogin}
        >
          {isLoggingIn ? 'Anmelden...' : 'Mit Dummy anmelden'}
        </Button>
      </Tabs.Content>
      
      <!-- NIP-07 TAB -->
      <Tabs.Content value="nip07" class="space-y-3">
        <p class="text-sm text-muted-foreground">
          Verwende eine Nostr-Browser-Extension wie Alby oder nos2x
        </p>
        
        <Button 
          class="w-full"
          disabled={isLoggingIn}
          onclick={handleNIP07Login}
        >
          {isLoggingIn ? 'Verbinde...' : 'Mit NIP-07 verbinden'}
        </Button>
      </Tabs.Content>
      
      <!-- NSEC TAB -->
      <Tabs.Content value="nsec" class="space-y-3">
        <p class="text-sm text-destructive text-xs">
          ⚠️ WARNUNG: Verwende NIEMALS einen echten Private Key im Browser!
          Nur für lokale Test-Keys!
        </p>
        {/* Implementierung später */}
      </Tabs.Content>
    </Tabs.Root>
    
  </Dialog.Content>
</Dialog.Root>
```

### 3.3 Sidebar Toggle Pattern

Die Sidebar-Visibility wird durch `settingsStore.showLeftSidebar` und `showRightSidebar` gesteuert:

```svelte
<!-- Topbar Toggle Buttons -->
<Button 
  variant="ghost" 
  size="sm"
  onclick={() => settingsStore.toggleLeftSidebar()}
>
  <PanelLeftIcon class="h-4 w-4" />
</Button>

<!-- +page.svelte Layout -->
<Resizable.PaneGroup direction="horizontal">
  {#if showLeftSidebar}
    <Resizable.Pane>
      <LeftSidebar />
    </Resizable.Pane>
  {/if}
  
  <Resizable.Pane>
    <Board />
  </Resizable.Pane>
  
  {#if showRightSidebar}
    <Resizable.Pane>
      <KIAgent />
    </Resizable.Pane>
  {/if}
</Resizable.PaneGroup>
```

---

## IV. Layout Structure

### Visual Hierarchy

```
┌─────────────────────────────────────────────────────┐
│  TOPBAR (Navbar)                                    │
│  [Sidebar Toggle] [Logo] [Theme] [Settings] [User] │
└─────────────────────────────────────────────────────┘
┌──────────────┬─────────────────────────┬────────────┐
│              │                         │            │
│  LEFT        │                         │   RIGHT    │
│  SIDEBAR     │   MAIN BOARD (Kanban)  │  SIDEBAR   │
│              │                         │  (KI)      │
│ • Board List │   [Col1] [Col2] [Col3] │            │
│ • Recent     │   Cards...              │            │
│ • Favorites  │                         │            │
│              │                         │            │
│ ──────────── │                         │            │
│              │                         │            │
│ [User Info]  │                         │            │
│ [Logout]     │                         │            │
│              │                         │            │
└──────────────┴─────────────────────────┴────────────┘
```

### +layout.svelte Struktur

```svelte
<script lang="ts">
  import Topbar from './Topbar.svelte';
  import LeftSidebar from './LeftSidebar.svelte';
  import RightSidebar from './RightSidebar.svelte';
  import { settingsStore } from '$lib/stores/settingsStore.svelte.js';
  
  let showLeftSidebar = $derived(settingsStore.showLeftSidebar);
  let showRightSidebar = $derived(settingsStore.showRightSidebar);
</script>

<div class="h-screen flex flex-col overflow-hidden">
  <Topbar />
  
  <Resizable.PaneGroup direction="horizontal" class="flex-1">
    {#if showLeftSidebar}
      <Resizable.Pane>
        <LeftSidebar />
      </Resizable.Pane>
      <Resizable.Handle />
    {/if}
    
    <Resizable.Pane defaultSize={60} minSize={30}>
      <slot />
    </Resizable.Pane>
    
    {#if showRightSidebar}
      <Resizable.Handle />
      <Resizable.Pane>
        <RightSidebar />
      </Resizable.Pane>
    {/if}
  </Resizable.PaneGroup>
</div>
```

---

## V. Integration Checklist

- ✅ LeftSidebarFooter in `src/routes/cardsboard/` erstellen
- ✅ LoginDialog in `src/routes/cardsboard/` erstellen
- ✅ Sidebar Toggle in Topbar einfügen
- ✅ +layout.svelte mit resizable Panels updaten
- ✅ AuthStore + SettingsStore verbinden
- ✅ Mobile-Responsive testen (Breakpoints)
- ✅ Logout mit Bestätigung testen
- ✅ NIP-07 Extension Check implementieren

---

## VI. Häufige Fehler

### ❌ Fehler 1: Logout ohne Bestätigung

```typescript
// FALSCH
onclick={() => authStore.logout()}  // Sofort gelöscht!

// RICHTIG
// Mit AlertDialog.Root für Bestätigung
<AlertDialog.Root open={showConfirm}>
  <AlertDialog.Trigger>Logout</AlertDialog.Trigger>
  <AlertDialog.Content>
    Sind Sie sicher?
    <AlertDialog.Action onclick={handleLogout}>
      Logout
    </AlertDialog.Action>
  </AlertDialog.Content>
</AlertDialog.Root>
```

### ❌ Fehler 2: Responsive Sidebar nicht aktualisiert

```typescript
// FALSCH
let showLeftSidebar = settingsStore.showLeftSidebar;  // Nicht reaktiv!

// RICHTIG
let showLeftSidebar = $derived(settingsStore.showLeftSidebar);  // Reaktiv!
```

### ❌ Fehler 3: Modal bleibt offen nach Login

```typescript
// FALSCH
const success = await authStore.loginWithDummy(name);
// open wird nicht geschlossen!

// RICHTIG
if (success) {
  open = false;  // ← Schließe Dialog
}
```

---

## VII. Referenzen

- **[AUTHSTORE.md](./AUTHSTORE.md)** — Authentifizierung & Session
- **[SETTINGSSTORE.md](./SETTINGSSTORE.md)** — Settings & Sidebar Visibility
- **[UX-RULES.md](./UX-RULES.md)** — Design Patterns (shadcn-svelte)

---

**Status:** ✅ Production Ready - Phase 1.4
