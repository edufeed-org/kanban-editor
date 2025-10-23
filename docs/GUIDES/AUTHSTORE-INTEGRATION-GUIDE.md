# AuthStore Integration & Usage Guide

**Stand:** 23. Oktober 2025  
**Status:** ✅ Production Ready  
**Component:** Sidebar Login Integration  

---

## 🎯 Quick Start: AuthStore verwenden

### Import

```typescript
import { authStore } from '$lib/stores/authStore.svelte';
```

### In Komponenten (Svelte 5 Runes)

```svelte
<script lang="ts">
    import { authStore } from '$lib/stores/authStore.svelte';
    
    // Reactive derived values (automatisch updated)
    let isAuthenticated = $derived(authStore.isAuthenticated);
    let currentUser = $derived(authStore.currentUser);
    let pubkey = $derived(authStore.getPubkey());
    let userName = $derived(authStore.getUserName());
</script>

{#if isAuthenticated}
    <div>Hallo, {userName}!</div>
{:else}
    <button onclick={() => showLoginDialog()}>Anmelden</button>
{/if}
```

---

## 📋 AuthStore API

### Properties (State)

```typescript
// Reaktive State
authStore.currentUser: UserSession | null
authStore.isAuthenticated: boolean  // derived
authStore.isLoading: boolean
authStore.errorMessage: string | null

// Typen
interface UserSession {
  pubkey: string;        // Hex Public Key (64 chars)
  npub: string;          // Bech32 encoded (für UI)
  name: string;          // Display Name (z.B. "Dev User")
  signerType: 'development' | 'nip07' | 'nip46';
  createdAt: number;
}
```

### Methods

```typescript
// Login (alle async!)
await authStore.loginWithDummy(name: string): boolean
await authStore.loginWithNsec(nsec: string, name: string): boolean
await authStore.loginWithNIP07(): boolean

// Getters
authStore.getPubkey(): string | null           // Hex format
authStore.getNpub(): string | null             // Bech32 format
authStore.getUserName(): string | null         // Display name

// Logout
authStore.logout(): void
authStore.getStatus(): AuthStatus             // Full status object

// Session
authStore.saveSession(): void                  // Manuell (auto bei login)
authStore.restoreSession(): void               // Automatisch bei init
```

---

## 🔐 Session Persistence

### localStorage Format

```json
{
  "kanban-auth-session": {
    "pubkey": "0000000000000000000000000000000000000000000000000000000000000001",
    "npub": "npub1dev00000000000000000000000000000000000000000000000000000000",
    "name": "Dev User",
    "signerType": "development",
    "createdAt": 1729691825598
  }
}
```

### SSR-Safety

AuthStore checkt automatisch `typeof window !== 'undefined'` vor localStorage-Zugriff:

```typescript
// Automatisch handled - sicher auch auf Server!
if (typeof window === 'undefined') {
    return; // Skip localStorage on SSR
}
```

---

## 💾 Integration mit BoardStore

### Auto-Author bei Card/Board Creation

```typescript
// In boardStore.svelte.ts
public createCard(columnId: string, name: string) {
    // ✅ Nutzt automatically AuthStore!
    const author = authStore.getUserName() || authStore.getPubkey() || 'anonymous';
    
    const cardProps: CardProps = {
        heading: name,
        publishState: 'draft',
        author: author  // ← Auto gesetzt!
    };
    
    // ... rest des Codes
}

public createBoard(name: string) {
    // ✅ Gleicher Pattern
    const author = authStore.getUserName() || authStore.getPubkey() || 'anonymous';
    
    const newBoard = new Board({
        name,
        author: author,  // ← Auto gesetzt!
        columns: [...]
    });
    
    // ... rest des Codes
}
```

### Result in localStorage

```json
{
  "board": {
    "id": "board-...",
    "name": "Mein Board",
    "author": "Dev User",  // ← Auto vom authStore!
    "columns": [{
      "cards": [{
        "id": "card-...",
        "heading": "Aufgabe",
        "author": "Dev User",  // ← Auto vom authStore!
        "comments": [{
          "text": "Kommentar",
          "author": "Dev User"   // ← Manuell übergeben, aber aus authStore
        }]
      }]
    }]
  }
}
```

---

## 🧪 Testing AuthStore

### Manual Testing in Browser

```javascript
// 1. Check initial state
console.log(authStore.isAuthenticated);  // false

// 2. Login
await authStore.loginWithDummy('Alice');
console.log(authStore.currentUser);      // { pubkey, npub, name, signerType }

// 3. Check persistence
console.log(localStorage.getItem('kanban-auth-session'));  // hat JSON

// 4. Create card (auto author)
boardStore.createCard('col-1', 'Test');
console.log(boardStore.data.columns[0].cards[0].author);   // "Alice"

// 5. Logout
authStore.logout();
console.log(authStore.isAuthenticated);  // false
console.log(localStorage.getItem('kanban-auth-session'));  // null
```

### Test Checklist

```
✅ loginWithDummy() setzt currentUser
✅ isAuthenticated wird true
✅ getPubkey() gibt Hex zurück
✅ getUserName() gibt Display Name zurück
✅ localStorage speichert Session
✅ Reload → Session wird restored
✅ logout() cleared Session aus localStorage
✅ createCard/Board nutzen auto author
```

---

## 🚀 Phase 2: NIP-07 Integration (TODO)

```typescript
// In loginWithNIP07()
if (!window.nostr) {
    throw new Error('No Nostr signer found. Install a browser extension like Alby!');
}

const signer = new NDKNip07Signer();
const user = await signer.user();

const session: UserSession = {
    pubkey: user.pubkey,
    npub: user.npub,
    name: user.profile?.name || 'Nostr User',  // Aus Nostr Profile
    signerType: 'nip07',
    createdAt: Date.now()
};
```

---

## 🔒 Security Notes

### ✅ DONE (Current Implementation)

```typescript
✅ Private Keys NIEMALS in localStorage speichern
✅ Nur pubkey (öffentlich) speichern
✅ Session-Expiration (7 Tage)
✅ localStorage.removeItem() bei logout()
✅ SSR-safe (typeof window check)
```

### ⏳ TODO (Phase 3)

```typescript
⏳ HTTPS enforce in Production
⏳ CSP Headers (Content Security Policy)
⏳ Session rotation (neuer Token bei jedem Login)
⏳ Profile picture URL validation (HTTPS + whitelist)
```

---

## 📚 Vollständiges Beispiel

### Component: ShowAuthStatus.svelte

```svelte
<script lang="ts">
    import { authStore } from '$lib/stores/authStore.svelte';
    import { Button } from '$lib/components/ui/button';
    import LoginDialog from './LoginDialog.svelte';
    
    let showLoginDialog = $state(false);
    let isAuthenticated = $derived(authStore.isAuthenticated);
    let userName = $derived(authStore.getUserName());
    let pubkey = $derived(authStore.getPubkey());
</script>

<div class="auth-container">
    {#if isAuthenticated}
        <div class="user-info">
            <p>Angemeldet als: <strong>{userName}</strong></p>
            <p class="text-sm text-gray-500">
                Pubkey: {pubkey?.slice(0, 8)}...{pubkey?.slice(-8)}
            </p>
            <Button onclick={() => authStore.logout()} variant="destructive">
                Abmelden
            </Button>
        </div>
    {:else}
        <Button onclick={() => showLoginDialog = true}>
            Anmelden
        </Button>
        <LoginDialog open={showLoginDialog} onClose={() => showLoginDialog = false} />
    {/if}
</div>

<style>
    .auth-container {
        padding: 1rem;
        border: 1px solid #e5e7eb;
        border-radius: 0.5rem;
    }
    
    .user-info {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }
</style>
```

---

## 🔄 Reactive Data Flow

```
authStore.loginWithDummy('Alice')
    ↓
this.currentUser = session  // $state update
    ↓
this.saveSession()          // localStorage.setItem()
    ↓
isAuthenticated $derived triggered
    ↓
Alle Komponenten die $derived(authStore.isAuthenticated) nutzen updaten
    ↓
LeftSidebarFooter re-renders (zeigt Avatar statt Button)
    ↓
boardStore.createCard() nutzt authStore.getPubkey()
    ↓
card.author = "Alice"  ← Auto gesetzt!
```

---

## ⚠️ Häufige Fehler

### Fehler 1: authStore nicht imported

```typescript
// ❌ FALSCH
const author = this.getPubkey();  // undefined!

// ✅ RICHTIG
import { authStore } from '$lib/stores/authStore.svelte';
const author = authStore.getPubkey();  // "0000..."
```

### Fehler 2: Synchroner Zugriff auf async Method

```typescript
// ❌ FALSCH
authStore.loginWithDummy('Alice');  // Vergessen: await!
console.log(authStore.isAuthenticated);  // false (zu früh!)

// ✅ RICHTIG
await authStore.loginWithDummy('Alice');
console.log(authStore.isAuthenticated);  // true
```

### Fehler 3: localStorage direkt statt AuthStore

```typescript
// ❌ FALSCH - localStorage kann auf Server nicht zugegriffen werden!
if (localStorage.getItem('user')) { ... }  // SSR-Error!

// ✅ RICHTIG - AuthStore handled SSR
authStore.restoreSession();  // SSR-safe
if (authStore.isAuthenticated) { ... }  // OK
```

---

## 📖 Weitere Ressourcen

- **AUTHSTORE-BASICS.md** - Anfänger-freundliche Erklärung
- **AUTHSTORE-IMPLEMENTATION.md** - Technische Details
- **src/lib/stores/authStore.svelte.ts** - Source Code mit JSDoc
- **copilot-instructions.md** - Best Practices für AI-Agenten

---

**Status:** ✅ PRODUCTION READY  
**Letzte Änderung:** 23. Oktober 2025
