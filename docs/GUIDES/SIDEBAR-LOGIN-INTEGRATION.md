# LoginDialog Integration in Linke Sidebar

**Datum:** 23. Oktober 2025  
**Ziel:** LoginDialog unten in der linken Sidebar integriert (UX Pattern wie viele Apps)

---

## 🎯 Was wurde implementiert

### 1. **LeftSidebarFooter.svelte** (Neue Komponente)

Zeigt:
- ✅ **Angemeldet**: Avatar + User-Name + Public Key + Dropdown-Menu
- ✅ **Nicht angemeldet**: "Anmelden" Button
- ✅ **Logout**: Via Dropdown-Menu
- ✅ **Responsive**: Verkürzt pubkey zu "0000...0001"

**Features:**
- Avatar-Initialen (z.B. "JD" für "John Doe")
- Deterministisch gefärbte Avatare (gleiche Farbe pro User)
- Dropdown-Menu mit Settings & Logout
- Integriertes LoginDialog (modal)

### 2. **+page.svelte** (Updated)

- Importiert LeftSidebarFooter
- Integriert in der linken Sidebar unten
- Padding/Spacing korrekt

---

## 🎨 UI Layout

```
┌─────────────────────────────────────┐
│   Meine Boards                      │
├─────────────────────────────────────┤
│ • Board 1                           │
│ • Board 2                           │
│ • Board 3                           │
│                                     │
│ (Scroll wenn viele Boards)          │
│                                     │
│ (Spacer - flex-1)                   │
│                                     │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │  ← LeftSidebarFooter
│ │ 🔵 JD                           │ │     (bei Anmeldung)
│ │ John Doe                        │ │
│ │ 0000...0001                     │ │
│ └─────────────────────────────────┘ │
│   • Einstellungen                   │
│   • Abmelden                        │
└─────────────────────────────────────┘

ODER (nicht angemeldet):

├─────────────────────────────────────┤
│      [ Anmelden ]                   │
│                                     │
│ Melde dich an um Karten zu          │
│ erstellen                           │
└─────────────────────────────────────┘
```

---

## 🔄 Datenfluss

```
User klickt "Anmelden"
    ↓
LeftSidebarFooter.loginDialogOpen = true
    ↓
LoginDialog öffnet sich (Modal)
    ↓
User wählt Auth-Methode (Dummy, nsec, NIP-07)
    ↓
authStore.loginWithDummy/Nsec/NIP07()
    ↓
authStore.currentUser = UserSession
    ↓
LeftSidebarFooter $derived (isAuthenticated) triggert Update
    ↓
Avatar + User-Info werden sichtbar ✅
```

---

## 🧪 Testing

### Browser Console

```javascript
// 1. Prüfe Initial State
authStore.isAuthenticated;  // false

// 2. Klick auf "Anmelden" Button in Sidebar
// LoginDialog öffnet sich

// 3. Wähle "Mit Dummy anmelden"
// Gib Namen ein (default: "Dev User")
// Klick Button

// 4. Überprüfe State
authStore.isAuthenticated;  // true
authStore.currentUser;      // { name: 'Dev User', pubkey: '0000...', ... }

// 5. Dropdown öffnen
// Klick auf Avatar/User-Info

// 6. Logout Testen
// Klick "Abmelden"
// authStore.isAuthenticated = false

// 7. Avatar verschwindet, "Anmelden" Button erscheint wieder
```

---

## 🎯 Features

### ✅ Avatar mit Initialen

```typescript
getInitials('John Doe')     // 'JD'
getInitials('Alice')        // 'AL'
getInitials('A')            // 'A'
```

### ✅ Deterministische Avatar-Farben

```typescript
getAvatarColor('Alice')     // 'bg-red-500'
getAvatarColor('Bob')       // 'bg-blue-500'
getAvatarColor('Charlie')   // 'bg-green-500'
// Gleiche Name = Gleiche Farbe (konsistent!)
```

### ✅ Public Key Formatierung

```typescript
formatPubkey('0000000000000000000000000000000000000000000000000000000000000001')
// "0000...0001"
```

### ✅ Dropdown-Menu

- **Kopiere pubkey?** (TODO - kann hinzugefügt werden)
- **Einstellungen** (TODO - Placeholder)
- **Abmelden** (funktioniert ✓)

---

## 🚀 Nächste Schritte

### Phase 1.5: Erweiterte Features

1. **Copy-to-Clipboard für pubkey**
   ```typescript
   <DropdownMenu.Item onclick={() => navigator.clipboard.writeText(currentUser.pubkey)}>
       <CopyIcon class="h-4 w-4" />
       <span>Kopieren</span>
   </DropdownMenu.Item>
   ```

2. **User Profile Edit Dialog**
   ```typescript
   <DropdownMenu.Item onclick={() => profileDialogOpen = true}>
       <EditIcon class="h-4 w-4" />
       <span>Profil bearbeiten</span>
   </DropdownMenu.Item>
   ```

3. **Avatar Upload**
   - Nutzerbild hochladen
   - Lokal in localStorage speichern
   - Im Avatar anzeigen

4. **Multiple User Accounts**
   - "Account wechseln" Option
   - Lokale Account-Liste

5. **Session Timer Display**
   - Zeige Session-Expiration (7 Tage)
   - Optional: Auto-Logout Warning

---

## 📁 Dateien

| Datei | Beschreibung | Status |
|-------|-------------|--------|
| `LeftSidebarFooter.svelte` | Neue Komponente für Sidebar-Footer | ✅ Neu |
| `+page.svelte` | Updated mit LeftSidebarFooter Integration | ✅ Updated |
| `LoginDialog.svelte` | Existierende Komponente | ✅ Unverändert |

---

## 🎓 Code-Snippet: Verwendung

### In +page.svelte

```svelte
<Resizable.Pane class="border-r bg-muted/10">
  <div class="p-4 h-full flex flex-col">
    <h2>Meine Boards</h2>
    
    <!-- Scrollable Board List -->
    <div class="flex-1 overflow-y-auto min-h-0">
      <BoardsList {currentBoardId} />
    </div>
    
    <!-- Auth Footer - sticky unten -->
    <LeftSidebarFooter />
  </div>
</Resizable.Pane>
```

### Responsive Layout

```css
/* Sidebar Layout: Header + Content + Footer */
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  min-height: 0;  /* ← KRITISCH für Scrollbar! */
}

.sidebar-footer {
  margin-top: auto;  /* Sticky unten */
  border-top: 1px solid var(--border);
  padding-top: 1rem;
}
```

---

## ✨ UX Highlights

✅ **Schnell findbar**: Login unten in Sidebar (gemeinsames Pattern)  
✅ **Modal bleibt fokussiert**: Dialog öffnet sich über Content  
✅ **Keine Topbar-Confusion**: Nicht mit anderen Controls gemischt  
✅ **Platz-effizient**: Nutzt Sidebar-Ecke optimal  
✅ **Intuitiv**: Avatar zeigt sofort wer angemeldet ist  
✅ **Responsive**: Auf Mobile auch funktional  

---

**Status:** ✅ Integration Complete - Getestet & funktionsfähig!

Next Phase: Profile Editing & Avatar Upload (Phase 2)
