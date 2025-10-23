# AuthStore - Basics Implementation für Kanban-Board

## 📋 Übersicht

Der **AuthStore** ist eine einfache Authentifizierungs-Verwaltung für das Kanban-Board. Sie verwaltet den aktuellen Benutzer und stellt seinen Public Key zur Verfügung.

### 🎯 Zweck

- **Card Author**: Jede neue Karte wird automatisch mit dem `card.author` des aktuellen Users gekennzeichnet
- **Comment Author**: Kommentare zeigen den Author an (existiert bereits)
- **Session Persistierung**: Benutzer bleibt angemeldet nach Reload
- **Entwicklung**: Dummy-User für schnelle lokale Tests

---

## 🏗️ Architektur

### Komponenten

```
src/lib/stores/authStore.svelte.ts
├── Public API:
│   ├── loginWithDummy(name)     → Dummy-User (Development)
│   ├── loginWithNsec(nsec)      → Private Key (WIP)
│   ├── loginWithNIP07()         → Browser Extension (WIP)
│   ├── logout()                 → Clear Session
│   ├── getPubkey()              → Current User Pubkey
│   ├── getNpub()                → Current User npub
│   └── currentUser              → $state Reactive
│
└── Integration:
    ├── boardStore.svelte.ts (createCard, addComment)
    ├── Card.svelte (zeigt card.author an)
    └── LoginDialog.svelte (UI)
```

### State

```typescript
export interface UserSession {
  pubkey: string;           // Hex Public Key
  npub: string;             // Bech32 npub
  name: string;             // Display Name
  signerType: SignerType;   // 'development' | 'nip07' | 'nip46'
  createdAt: number;        // Timestamp
}

// In AuthStore:
public currentUser = $state<UserSession | null>(null);
public isAuthenticated = $derived(!!this.currentUser);
```

---

## 🚀 Verwendung

### 1. Dummy-User für Development

```typescript
import { authStore } from '$lib/stores/authStore.svelte';

// Login mit Dummy
await authStore.loginWithDummy('Mein Name');

// Aktuell angemeldet?
console.log(authStore.isAuthenticated); // true
console.log(authStore.currentUser?.name); // 'Mein Name'

// Pubkey abrufen (wird in createCard() verwendet)
const pubkey = authStore.getPubkey(); // '0000...0001'
```

### 2. Automatischer Card Author

```typescript
// In boardStore.createCard():
const author = authStore.getPubkey(); // ← Automatisch gesetzt!

const cardProps = {
  heading: 'Neue Karte',
  content: '...',
  author: author // ✅ Card kennt ihren Author!
};
```

### 3. In Komponenten (reaktiv)

```svelte
<script>
  import { authStore } from '$lib/stores/authStore.svelte';
  
  // Reaktive Werte
  let isAuthenticated = $derived(authStore.isAuthenticated);
  let currentUserName = $derived(authStore.currentUser?.name);
</script>

{#if isAuthenticated}
  <p>Welcome, {currentUserName}!</p>
{:else}
  <button onclick={() => authStore.loginWithDummy()}>
    Login
  </button>
{/if}
```

### 4. Session Persistierung

```typescript
// Automatisch:
// 1. Nach Login → localStorage.setItem('kanban-auth-session', ...)
// 2. Bei App-Start → authStore.restoreSession() aufgerufen
// 3. Nach Logout → localStorage.removeItem('kanban-auth-session')
```

---

## 📊 Integration mit bestehenden Features

### Card.svelte

```svelte
{#if card.author}
  <div class="author-info" title={card.author}>
    <span class="author-label">von</span>
    <code class="author-npub">{card.author.slice(0, 8)}...</code>
  </div>
{/if}
```

**Vorher**: `card.author` war immer `undefined` ❌  
**Nachher**: `card.author` wird automatisch gesetzt ✅

### kanbanStore.svelte.ts

```typescript
public addComment(cardId: string, text: string, author: string): void {
    // Bereits vorhanden ✅
}

public createCard(columnId: string, name: string): string {
    const author = authStore.getPubkey(); // ← NEU!
    // ...
}
```

---

## 🔐 Security Notes

### ✅ Was wird gespeichert

- **localStorage**: `{ pubkey, npub, name, signerType, createdAt }`
- **KEIN Private Key!** ❌

### ⚠️ Development vs Production

| Aspekt | Development | Production |
|--------|-------------|-----------|
| **loginWithDummy()** | ✅ Erlaubt | ❌ Entfernt |
| **loginWithNsec()** | ✅ Optional | ❌ Entfernt |
| **loginWithNIP07()** | ⚠️ WIP | ✅ Primary |
| **Storage** | localStorage | IndexedDB + TTL |

---

## 🔮 Zukunft: NIP-07 Integration

```typescript
// Später (Phase 1.4):
public async loginWithNIP07(): Promise<boolean> {
  try {
    const signer = new NDKNip07Signer();
    const user = await signer.user();
    
    const session: UserSession = {
      pubkey: user.pubkey,
      npub: user.npub,
      name: user.profile?.name || 'Anonym',
      signerType: 'nip07',
      createdAt: Date.now()
    };
    
    this.currentUser = session;
    this.saveSession();
    return true;
  } catch (error) {
    // ...
  }
}
```

---

## 🧪 Testing

### Console-Tests

```javascript
// Browser Console:

// 1. Login
await authStore.loginWithDummy('Test User');
// Output: ✅ Dummy user logged in: { name: 'Test User', pubkey: '00000000...' }

// 2. Check Status
authStore.getStatus();
// Output: { isAuthenticated: true, isLoading: false, user: {...} }

// 3. Create Card (mit autor!)
boardStore.createCard('col-1', 'Test Karte');
// Output: ✅ Karte erstellt: ... mit author: 00000000...

// 4. Verify Card has Author
const cards = boardStore.data.columns[0].cards;
console.log(cards[0].author); // '0000...0001'

// 5. Logout
authStore.logout();
// Output: ✅ User logged out
```

---

## 📁 Dateistruktur

```
src/lib/stores/
├── authStore.svelte.ts          ← Hauptimplementierung
├── kanbanStore.svelte.ts         ← Integration (createCard, addComment)
└── settingsStore.ts

src/routes/cardsboard/
└── LoginDialog.svelte            ← UI für Login

docs/ARCHITECTURE/
└── NOSTR-USER.md                 ← Vollständige Spezifikation
```

---

## 🐛 Known Issues & Workarounds

### Issue 1: Karte hat keinen Author nach Create

**Problem**: `card.author` ist undefined  
**Ursache**: AuthStore nicht initialisiert oder User nicht angemeldet  
**Workaround**: `await authStore.loginWithDummy()` vor `boardStore.createCard()`

### Issue 2: Session nicht persistent

**Problem**: Nach Reload ist User nicht mehr angemeldet  
**Ursache**: Browser localStorage deaktiviert (z.B. Private Browsing)  
**Workaround**: Public Browsing deaktivieren oder erneut anmelden

---

## 📚 Weitere Ressourcen

- [NOSTR-USER.md](../docs/ARCHITECTURE/NOSTR-USER.md) - Vollständige Auth-Spezifikation
- [AGENTS.md](../AGENTS.md) - Datenmodell & Card-Struktur
- [STORES.md](../docs/ARCHITECTURE/STORES.md) - Store-Architektur
