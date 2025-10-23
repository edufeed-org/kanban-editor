# 📊 AuthStore Implementation - Visueller Überblick

## 🔄 Datenfluss: Von AuthStore zu Card.author

```
┌─────────────────────────────────────────────────────────────────────┐
│                        APP STARTUP                                  │
└────────────────────────────┬────────────────────────────────────────┘
                             ↓
                   ┌──────────────────────┐
                   │  AuthStore.init()    │
                   │ restoreSession()     │
                   └─────────┬────────────┘
                             ↓
              ┌──────────────────────────────┐
              │ localStorage has session?    │
              └──┬─────────────────────────┬─┘
                 │                         │
            Yes  │                         │  No
                 ↓                         ↓
          ┌─────────────┐        ┌────────────────┐
          │ Restore     │        │ User not auth  │
          │ currentUser │        │ (null)         │
          └──────┬──────┘        └────────┬───────┘
                 │                        │
                 └────────────┬───────────┘
                              ↓
                    ┌─────────────────────┐
                    │ App renders         │
                    │ LoginDialog visible?│
                    │ if !isAuthenticated │
                    └────────────┬────────┘
                                 ↓
```

---

## 🔐 Login Flow

```
┌───────────────────────────────────┐
│   User clicks "Mit Dummy anmelden"│
└────────────┬──────────────────────┘
             ↓
┌──────────────────────────────────────────┐
│  await authStore.loginWithDummy('Alice') │
└────────────┬─────────────────────────────┘
             ↓
    ┌────────────────────────┐
    │ Create UserSession:    │
    │  pubkey: '000...0001'  │
    │  npub: 'npub...dev'    │
    │  name: 'Alice'         │
    │  signerType: 'dev'     │
    └────────────┬───────────┘
             ↓
    ┌─────────────────────────────────┐
    │ authStore.currentUser = session │
    └────────────┬────────────────────┘
             ↓
    ┌──────────────────────────────────────┐
    │ localStorage.setItem(                │
    │   'kanban-auth-session',             │
    │   JSON.stringify(session)            │
    │ )                                    │
    └────────────┬─────────────────────────┘
             ↓
    ┌──────────────────────────┐
    │ return true ✅           │
    │ (LoginDialog schließt)   │
    └──────────────────────────┘
```

---

## 🆕 Create Card Flow (mit Author!)

```
┌─────────────────────────────────────┐
│  User klickt "Neue Karte"           │
│  Column.svelte → Board.svelte       │
└────────────┬────────────────────────┘
             ↓
┌──────────────────────────────────┐
│ boardStore.createCard(           │
│   columnId,                      │
│   'Kartentitel'                  │
│ )                                │
└────────────┬─────────────────────┘
             ↓
    ┌───────────────────────────────┐
    │ const author =                │
    │   authStore.getPubkey()       │◄── NEU! (vorher undefined)
    │                               │
    │ // '0000...0001'              │
    └───────────────┬───────────────┘
                    ↓
    ┌───────────────────────────────┐
    │ const cardProps = {           │
    │   heading: 'Kartentitel',     │
    │   content: '...',             │
    │   publishState: 'draft',      │
    │   author: '0000...0001'  ◄NEU!|
    │ }                             │
    └───────────────┬───────────────┘
                    ↓
    ┌───────────────────────────────┐
    │ board.findColumn()            │
    │   .addCard(cardProps)         │
    └───────────────┬───────────────┘
                    ↓
    ┌───────────────────────────────┐
    │ triggerUpdate()               │
    │  • updateTrigger++            │
    │  • localStorage updated       │
    └───────────────┬───────────────┘
                    ↓
    ┌───────────────────────────────┐
    │ publishToNostr()              │
    │ (async, später)               │
    └───────────────┬───────────────┘
                    ↓
    ┌───────────────────────────────┐
    │ return cardId                 │
    └───────────────────────────────┘
```

---

## 🎨 UI: Card mit Author

```
┌─────────────────────────────────────────────────┐
│                    CARD                         │
├─────────────────────────────────────────────────┤
│ Kartentitel                    von 00000000...  │ ◄── NEW!
│                                [Publish] [...]  │
├─────────────────────────────────────────────────┤
│ • Label1 • Label2                               │
│                                                 │
│ [Optional Card Image]                           │
│                                                 │
│ Kartenbeschreibung hier...                      │
├─────────────────────────────────────────────────┤
│ 💬 2    👤 00000000...    [👁️]    [✏️]        │
└─────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
src/lib/stores/
├── authStore.svelte.ts          ← NEW! Benutzer-Verwaltung
│   ├── Class: AuthStore
│   ├── Interface: UserSession
│   ├── Methoden: loginWithDummy(), getPubkey(), logout()
│   └── Export: authStore (Singleton)
│
└── kanbanStore.svelte.ts         ← UPDATED! AuthStore Integration
    ├── Import: authStore
    └── createCard() ← Nutzt authStore.getPubkey()

src/routes/cardsboard/
├── LoginDialog.svelte            ← NEW! UI für Login
│   ├── 3 Tabs: Dummy, nsec, NIP-07
│   ├── Dummy-Tab aktiv
│   └── Fehler-Handling

└── Card.svelte                   ← UNCHANGED (funktioniert jetzt!)
    └── Zeigt card.author an (Zeile 76)

docs/
├── GUIDES/
│   └── AUTHSTORE-BASICS.md       ← NEW! Ausführliche Doku
└── ARCHITECTURE/
    └── AUTHSTORE-IMPLEMENTATION.md ← NEW! Zusammenfassung
```

---

## 🔍 Reactive Flow (Svelte 5)

```
authStore.$state (currentUser)
    │
    ├─→ $derived: isAuthenticated
    │     └─ Gelesen von: Components (Conditional Rendering)
    │
    └─→ Methode: getPubkey()
        └─ Gelesen von: boardStore.createCard()
           └─ Gespeichert in: cardProps.author
              └─ Gespeichert in: card.author (Card-Instanz)
                 └─ Gelesen von: Card.svelte
                    └─ Gerendert als: <div class="author-info">von 00000000...</div>
```

---

## 🎯 Test-Szenarios

### Scenario 1: Happy Path

```
1. App startet
   → AuthStore.restoreSession()
   → Kein User in localStorage
   → authStore.isAuthenticated = false ✓

2. User klickt "Mit Dummy anmelden"
   → LoginDialog.svelte handleDummyLogin()
   → await authStore.loginWithDummy('Alice')
   → authStore.currentUser = { name: 'Alice', pubkey: '000...', ... }
   → localStorage updated
   → LoginDialog schließt
   → authStore.isAuthenticated = true ✓

3. User klickt "Neue Karte"
   → boardStore.createCard('col-1', 'Test')
   → author = authStore.getPubkey() = '000...0001'
   → Karte erstellt mit author ✓

4. Card.svelte rendert
   → card.author = '000...0001'
   → Zeigt: "von 00000000..." ✓

5. User reloaded Seite
   → AuthStore.restoreSession()
   → currentUser aus localStorage restored ✓
   → User bleibt angemeldet ✓
```

### Scenario 2: Logout

```
1. User klickt Logout-Button
   → authStore.logout()
   → currentUser = null
   → localStorage cleared
   → authStore.isAuthenticated = false ✓

2. Neue Karte kann nicht erstellt werden (kein Author!)
   → boardStore.createCard() wird trotzdem aufgerufen
   → author = authStore.getPubkey() = null
   → cardProps.author = undefined
   → ⚠️ Card hat keinen Author
   → ℹ️ LoginDialog sollte wieder sichtbar sein
```

---

## 🧪 Browser Console Test

```javascript
// 1. Check initial state
authStore.isAuthenticated;  // false
authStore.currentUser;      // null

// 2. Login
await authStore.loginWithDummy('Test User');
// ✅ Dummy user logged in: { name: 'Test User', pubkey: '00000000...' }

// 3. Check state after login
authStore.isAuthenticated;  // true
authStore.currentUser;      // { name: 'Test User', pubkey: '00000000...', ... }
authStore.getPubkey();      // '0000000000000000000000000000000000000000000000000000000000000001'

// 4. Create card
const cardId = boardStore.createCard('col-1', 'New Card');
// ✅ Karte erstellt: ... mit author: 00000000...

// 5. Verify card has author
const card = boardStore.data.columns[0].cards.find(c => c.id === cardId);
card.author;  // '0000000000000000000000000000000000000000000000000000000000000001'

// 6. Logout
authStore.logout();
// ✅ User logged out

// 7. Session persisted?
localStorage.getItem('kanban-auth-session');  // null (nach logout)
// Aber vor logout: '{"pubkey":"0000...","npub":"npub...","name":"Test User",...}'
```

---

## 🎓 Learnings für Developer

### ✅ Svelte 5 Runes Pattern

```typescript
// AuthStore mit Svelte 5 $state und $derived
export class AuthStore {
  public currentUser = $state<UserSession | null>(null);
  public isAuthenticated = $derived(!!this.currentUser); // Automatisch reaktiv!
  
  // Komponenten abonnieren automatisch changes:
  let isAuth = $derived(authStore.isAuthenticated);
  // Reagiert sofort wenn authStore.currentUser sich ändert!
}
```

### ✅ Store-Integration Pattern

```typescript
// In boardStore.createCard():
const author = authStore.getPubkey(); // ← Cross-Store Kommunikation!

// Ähnlich wie addComment():
boardStore.addComment(cardId, text, author); // ← author wird übergeben
```

### ✅ Session Persistierung Pattern

```typescript
private saveSession(): void {
  localStorage.setItem('kanban-auth-session', JSON.stringify(this.currentUser));
}

private restoreSession(): void {
  const stored = localStorage.getItem('kanban-auth-session');
  if (stored) this.currentUser = JSON.parse(stored);
}
```

---

## 🚀 Next Steps (für nächsten PR)

1. **LoginDialog in Topbar integrieren**
   - Nur zeigen wenn `!authStore.isAuthenticated`
   - Oder als Modal im +layout.svelte

2. **Logout Button**
   - In User-Dropdown-Menu
   - Bestätigung anfordern

3. **User Display in Topbar**
   - Zeige: "Angemeldet als: Alice (00000000...)"

4. **NIP-07 Implementation**
   - loginWithNIP07() fully implement
   - Browser extension checks
   - Error handling

5. **Tests schreiben**
   - Unit tests für AuthStore
   - E2E tests für Card-Creation Flow

---

**Status:** ✅ Implementation Complete - Ready for Integration!
