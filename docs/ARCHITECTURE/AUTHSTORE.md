# AuthStore - Vollständige Dokumentation

**Datum:** 25. Oktober 2025  
**Framework:** Svelte 5, TypeScript, NDK  
**Status:** Phase 1.4 - Authentifizierung  
**Ein-Dokument-Prinzip:** ✅ Konsolidiert aus 4 Dateien

---

## I. Übersicht & Architektur

AuthStore verwaltet die Nostr-Benutzerauthentifizierung mit Session-Persistierung. Jede neue Karte wird automatisch mit dem aktuellen User als `card.author` gekennzeichnet.

### Zweck

- ✅ **Card Author**: Karten kennen ihren Ersteller
- ✅ **Session Persistierung**: Benutzer bleibt angemeldet nach Reload
- ✅ **Svelte 5 Runes**: Vollständige Reaktivität mit `$state` + `$derived`
- ✅ **Dummy-User**: Schnelle lokale Tests ohne NIP-07

### Komponenten-Übersicht

```
AuthStore ($state reactive)
    ├── currentUser: UserSession | null
    ├── isAuthenticated: $derived boolean
    └── Methoden:
        ├── loginWithDummy(name: string)
        ├── loginWithNsec(nsec: string)
        ├── loginWithNIP07()
        ├── logout()
        ├── getPubkey(): string | null
        └── getNpub(): string | null

Integration:
    ├── boardStore.createCard() → nutzt authStore.getPubkey()
    ├── boardStore.addComment() → nutzt authStore.getPubkey()
    ├── Card.svelte → zeigt card.author an
    └── LoginDialog.svelte → UI für Login
```

---

## II. Quick Start (5 Minuten)

### Installation & Login

```typescript
import { authStore } from '$lib/stores/authStore.svelte.js';

// 1. Dummy-User für Development
await authStore.loginWithDummy('Alice');
console.log(authStore.isAuthenticated);  // true
console.log(authStore.currentUser?.name);  // 'Alice'

// 2. In einer Komponente (reaktiv)
let isAuth = $derived(authStore.isAuthenticated);
let userName = $derived(authStore.currentUser?.name);

// 3. Logout
authStore.logout();
```

### Integration in Card Creation

```typescript
// In boardStore.createCard():
const author = authStore.getPubkey(); // ← Automatisch!

const cardProps = {
  heading: 'Neue Karte',
  author: author || undefined  // Card kennt ihren Author
};
```

---

## III. Vollständige Implementierung

### 3.1 Interfaces & Types

```typescript
export type SignerType = 'dummy' | 'nsec' | 'nip07' | 'nip46';

export interface UserProfile {
  name?: string;
  about?: string;
  picture?: string;
  nip05?: string;
  lud16?: string;
}

export interface UserSession {
  pubkey: string;      // Hex: '0000...0001'
  npub: string;        // Bech32: 'npub1...'
  profile: UserProfile;
  signerType: SignerType;
  lastLogin: number;   // Unix timestamp
  expires: number;     // Session TTL (7 Tage)
}
```

### 3.2 AuthStore Klasse

```typescript
// src/lib/stores/authStore.svelte.ts
import { persisted } from 'svelte-persisted-store';
import { get } from 'svelte/store';
import type NDK from '@nostr-dev-kit/ndk';
import { NDKUser } from '@nostr-dev-kit/ndk';

export class AuthStore {
  // Session wird automatisch in localStorage gespeichert
  private sessionStore = persisted<UserSession | null>(
    'kanban-auth-session',
    null,
    {
      serializer: JSON,
      onWrite: (value) => console.log('📥 Session saved:', value?.pubkey),
      onRead: (value) => console.log('📤 Session loaded:', value?.pubkey)
    }
  );

  // Reaktive $state Variablen
  public currentUser = $state<UserSession | null>(null);
  
  // $derived automatisch berechnet
  public isAuthenticated = $derived(!!this.currentUser);
  
  private ndk: NDK;

  constructor(ndk: NDK) {
    this.ndk = ndk;
    this.restoreSession();
  }

  // ============================================
  // LOGIN METHODEN
  // ============================================

  public async loginWithDummy(name: string): Promise<boolean> {
    try {
      // Generiere eine deterministische Pubkey für Dummy-User
      const pubkey = '0000000000000000000000000000000000000000000000000000000000000001';
      
      const session: UserSession = {
        pubkey,
        npub: this.pubkeyToNpub(pubkey),
        profile: {
          name: name || 'Anonymous',
          about: 'Dummy Test User'
        },
        signerType: 'dummy',
        lastLogin: Date.now(),
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 Tage
      };

      this.sessionStore.set(session);
      this.currentUser = session;
      
      console.log('✅ Dummy user logged in:', session);
      return true;
    } catch (error) {
      console.error('❌ Dummy login failed:', error);
      return false;
    }
  }

  public async loginWithNsec(nsec: string): Promise<boolean> {
    try {
      // ⏳ TODO: NIP-49 Implementierung
      console.warn('⚠️  nsec login not yet implemented');
      return false;
    } catch (error) {
      console.error('❌ nsec login failed:', error);
      return false;
    }
  }

  public async loginWithNIP07(): Promise<boolean> {
    try {
      // Check if NIP-07 extension is available
      if (!window.nostr) {
        throw new Error('NIP-07 extension not found. Install a Nostr signer!');
      }

      // Get user's public key from extension
      const pubkey = await window.nostr.getPublicKey();
      
      // Create NDK user
      const user = new NDKUser({ hexpubkey: pubkey });
      await user.fetchProfile();

      const session: UserSession = {
        pubkey,
        npub: user.npub,
        profile: {
          name: user.profile?.name,
          about: user.profile?.about,
          picture: user.profile?.picture,
          nip05: user.profile?.nip05,
          lud16: user.profile?.lud16
        },
        signerType: 'nip07',
        lastLogin: Date.now(),
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000
      };

      this.sessionStore.set(session);
      this.currentUser = session;
      
      console.log('✅ NIP-07 user logged in:', session);
      return true;
    } catch (error) {
      console.error('❌ NIP-07 login failed:', error);
      return false;
    }
  }

  // ============================================
  // LOGOUT & SESSION MANAGEMENT
  // ============================================

  public logout(): void {
    this.sessionStore.set(null);
    this.currentUser = null;
    console.log('✅ User logged out');
  }

  private restoreSession(): void {
    const stored = get(this.sessionStore);
    
    if (!stored) return;

    // Check if session has expired
    if (stored.expires < Date.now()) {
      this.sessionStore.set(null);
      console.log('⏰ Session expired');
      return;
    }

    this.currentUser = stored;
    console.log('✅ Session restored:', stored.pubkey);
  }

  // ============================================
  // GETTERS
  // ============================================

  public getPubkey(): string | null {
    return this.currentUser?.pubkey ?? null;
  }

  public getNpub(): string | null {
    return this.currentUser?.npub ?? null;
  }

  public getUserName(): string | null {
    return this.currentUser?.profile?.name ?? null;
  }

  public getSignerType(): SignerType | null {
    return this.currentUser?.signerType ?? null;
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private pubkeyToNpub(pubkey: string): string {
    // Simplified: In production nutze bech32 library
    return `npub1${pubkey.slice(0, 8)}...${pubkey.slice(-8)}`;
  }
}

// Globale Singleton-Instanz
export const authStore = new AuthStore(ndk);
```

### 3.3 Session Storage mit `persisted()`

```typescript
// Warum persisted()?
private sessionStore = persisted<UserSession | null>(
    'kanban-auth-session',  // localStorage key
    null,                   // default value
    {
      serializer: JSON,     // Serialisierungs-format
      onWrite: (value) => {...},    // Callback beim Speichern
      onRead: (value) => {...}      // Callback beim Laden
    }
);

// Automatisches Behavior:
// 1. App startet → persisted() lädt aus localStorage
// 2. sessionStore.set(session) → localStorage aktualisiert
// 3. Multi-Tab: Andere Tabs werden benachrichtigt (localStorage events)
// 4. Browser-Reload: Session wird automatisch wiederhergestellt
```

---

## IV. Lifecycle: Login → Reload → Logout

### Schritt 1: App-Startup

```
1. App initialisiert → +layout.svelte
2. AuthStore wird instanziiert
   └─→ constructor() ruft restoreSession() auf
3. persisted() lädt Session aus localStorage
   └─→ Falls vorhanden und nicht abgelaufen: currentUser = session
4. UI wird gerendert
   └─→ $derived(isAuthenticated) berechnet automatisch
   └─→ LoginDialog zeigt nur wenn !isAuthenticated
```

### Schritt 2: User Login

```
User klickt "Mit Dummy anmelden"
    ↓
LoginDialog.svelte handleDummyLogin()
    ↓
authStore.loginWithDummy('Alice')
    ↓
Neue UserSession erstellt
    ↓
sessionStore.set(session)  ← persisted() speichert zu localStorage
    ↓
currentUser = session  ← $state aktualisiert
    ↓
isAuthenticated = $derived(true)  ← UI re-renders automatisch
```

### Schritt 3: Browser-Reload

```
User drückt F5 (Reload)
    ↓
+layout.svelte lädt neu
    ↓
AuthStore constructor() → restoreSession()
    ↓
persisted() lädt Session aus localStorage
    ↓
currentUser = session  ← Automatisch wiederhergestellt!
    ↓
User bleibt angemeldet ✅
```

### Schritt 4: Card Creation mit Author

```
User klickt "Neue Karte"
    ↓
boardStore.createCard('col-id', 'Titel')
    ↓
const author = authStore.getUserName()  ← "Dev User" (oder getPubkey() fallback)
    ↓
CardProps.author = "Dev User"
    ↓
1. triggerUpdate() aufgerufen
   ↓
2. saveToStorage() speichert zu localStorage
   ↓
3. board.getContextData(true) serialisiert:
   ↓
   return {
       id, name, author: "Dev User",  // ✅ author dabei!
       columns: [{
           cards: [{
               id, heading, author: "Dev User",  // ✅ author dabei!
               comments: [{ author: "Dev User" }]  // ✅ bereits dabei
           }]
       }]
   }
   ↓
4. JSON.stringify() + localStorage.setItem()
   ↓
5. Browser-Reload: reconstructBoard() lädt author!
   ↓
Card zeigt: "von Dev User" ✅
```

**KRITISCH:** `getContextData()` muss ALLE Felder zurückgeben!
- Wenn `Card.author` nicht in `getContextData()` ist → wird nicht zu localStorage gespeichert!
- Nach Reload ist der author weg!


### Schritt 5: Logout oder Expiration

```
User klickt "Logout"
    ↓
authStore.logout()
    ↓
sessionStore.set(null)  ← persisted() löscht localStorage
    ↓
currentUser = null
    ↓
isAuthenticated = $derived(false)
    ↓
LoginDialog wird wieder sichtbar ✅
```

---

## V. UI Integration

### LeftSidebarFooter.svelte

```svelte
<script lang="ts">
  import { authStore } from '$lib/stores/authStore.svelte.js';
  import { Button } from '$lib/components/ui/button';
  import UserIcon from "@lucide/svelte/icons/user";
  import LogOutIcon from "@lucide/svelte/icons/log-out";
  
  // Reaktive Ableitungen
  let isAuthenticated = $derived(authStore.isAuthenticated);
  let currentUserName = $derived(authStore.getUserName());
</script>

<div class="sidebar-footer border-t p-4">
  {#if isAuthenticated}
    <div class="space-y-3">
      <div class="flex items-center gap-2 text-sm">
        <UserIcon class="h-4 w-4" />
        <span class="font-medium">{currentUserName ?? 'User'}</span>
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
```

### Card.svelte mit Author

```svelte
<script lang="ts">
  import * as Card from "$lib/components/ui/card";
  import type { CardType } from "./types";
  
  let { card } = $props();
</script>

<Card.Root>
  <Card.Header class="pb-3">
    <div class="flex items-start justify-between">
      <Card.Title class="text-sm font-medium">
        {card.heading}
      </Card.Title>
      {#if card.author}
        <div class="text-xs text-muted-foreground">
          von {card.author.slice(0, 8)}...
        </div>
      {/if}
    </div>
  </Card.Header>
</Card.Root>
```

---

## VI. Häufige Fehler

### ❌ Fehler 1: `get()` nicht importiert

```typescript
// FALSCH
const stored = this.sessionStore;  // Das ist der Store, nicht der Wert!

// RICHTIG
import { get } from 'svelte/store';
const stored = get(this.sessionStore);
```

### ❌ Fehler 2: Session wird nicht persisted

```typescript
// FALSCH
this.currentUser = session;
// sessionStore nicht aktualisiert! → localStorage bleibt leer

// RICHTIG
this.sessionStore.set(session);  // ← MUSS sein!
this.currentUser = session;
```

### ❌ Fehler 3: $derived Dependency falsch

```typescript
// FALSCH
$effect(() => {
    if (authStore.currentUser?.profile?.name) {  // Zu granular!
        console.log('logged in');
    }
});

// RICHTIG
$effect(() => {
    const user = authStore.currentUser;  // Ganzer Wert lesen
    if (user?.profile?.name) {
        console.log('logged in');
    }
});
```

### ❌ Fehler 4: Optional chaining vergessen

```typescript
// FALSCH
<div>{currentUser.profile.name}</div>
// FEHLER: profile kann undefined sein!

// RICHTIG
<div>{currentUser?.profile?.name ?? 'Anonymous'}</div>
```

### ❌ Fehler 5: Private Keys speichern

```typescript
// 🔴 SECURITY: NIEMALS!
localStorage.setItem('nsec', nsec);

// ✅ RICHTIG: Nur pubkey speichern
localStorage.setItem('pubkey', pubkey);
```

---

## VII. Entwicklungs-Workflow

### Browser Console Testing

```javascript
// 1. Check initial state
authStore.isAuthenticated;      // false
authStore.currentUser;          // null

// 2. Login mit Dummy
await authStore.loginWithDummy('Test User');
// ✅ Dummy user logged in: {...}

// 3. Verify state
authStore.isAuthenticated;      // true
authStore.getPubkey();          // '0000...0001'

// 4. Create card
const cardId = boardStore.createCard('col-1', 'Test Card');

// 5. Verify card has author
const card = boardStore.data.columns[0].cards[0];
card.author;                    // '0000...0001' ✅

// 6. Logout
authStore.logout();
authStore.isAuthenticated;      // false
```

### Test-Szenarios

| Szenario | Vorbereitung | Erwartet |
|----------|-------------|----------|
| **App-Start ohne Session** | Keine localStorage | LoginDialog sichtbar |
| **Dummy-Login** | Click "Mit Dummy" | Session gespeichert, angemeldet |
| **Reload (persistent)** | Nach Login F5 drücken | User bleibt angemeldet |
| **Logout** | Logout klicken | Session gelöscht, LoginDialog |
| **Card mit Author** | Nach Login neue Karte | card.author = pubkey |

---

## VIII. 🎯 Kritische Learning Patterns (aus AUTHOR-FIELD-ATTRIBUTION.md)

### Pattern 1: getContextData() MUSS alle Felder serialisieren!

**FEHLER:** Ein Feld wird auf der Klasse definiert, aber nicht in `getContextData()` zurückgegeben.

```typescript
// ❌ ANTIPATTERN - FELDVERLUST!
export class Card {
  public author?: string;      // Feld existiert
  
  getContextData() {
    return { id, heading, content, ... };  // ❌ author FEHLT!
  }
}

// Folge:
// 1. User erstellt Karte → card.author = 'Dev User' ✓ (in Memory)
// 2. saveToStorage() → getContextData() gibt author NICHT zurück
// 3. localStorage.setItem() → author FEHLT in JSON ✗
// 4. Browser Reload → author = undefined ✗ (DATENVERLUST!)

// ✅ RICHTIG - FELDKONSISTENZ!
export class Card {
  public author?: string;
  
  getContextData() {
    return { 
      id, heading, content,
      author: this.author,  // ← author MUSS hier sein!
      comments: this.comments.map(...),
      // ...
    };
  }
}
```

**Fix-Checkliste bei neuen Feldern:**
```
1. ✅ public field?: Type auf der Klasse
2. ✅ Im Constructor initialisiert (this.field = props.field)
3. ✅ IN getContextData() ZURÜCKGEGEBEN (field: this.field)
4. ✅ IN reconstructBoard() GELADEN (field: cardData.field)
5. ✅ Browser-Test: localStorage hat Feld nach Reload
```

### Pattern 2: Author Attribution Fallback-Kette

```typescript
// IMMER diese Hierarchie nutzen:
const author = authStore.getUserName()  // 1. "Dev User" (display name)
  || authStore.getPubkey()              // 2. "0000...0001" (fallback)
  || 'anonymous';                       // 3. 'anonymous' (letzter ausweg)
```

### Pattern 3: Data Flow Serialisierung

```
User erstellt Karte mit author
  ↓
triggerUpdate() aufgerufen
  ↓
saveToStorage() aufgerufen
  ↓
board.getContextData(true) — author MUSS serialisiert sein!
  ↓
JSON.stringify() + localStorage
  ↓ Browser Reload
reconstructBoard() lädt author
  ↓
card.author = '0000...0001' ✅
```

---

## IX. Referenzen & Cross-Links

- **[NOSTR-USER.md](./NOSTR-USER.md)** — Vollständige Authentifizierungs-Spezifikation
- **[STORES.md](./STORES.md)** — State Management (Reaktivität & Persistierung)
- **[PROP-VS-STATE-CHEATSHEET.md](../GUIDES/PROP-VS-STATE-CHEATSHEET.md)** — Svelte 5 Quick Reference
- **[NDK.md](./NDK.md)** — Nostr Development Kit (für NIP-07 Integration)
- **ARCHIVED:** AUTHOR-FIELD-ATTRIBUTION.md (Sections III-VIII merged here)

---

**Status:** ✅ Phase 1.4 - AuthStore Complete (inkl. Author Attribution Patterns)
