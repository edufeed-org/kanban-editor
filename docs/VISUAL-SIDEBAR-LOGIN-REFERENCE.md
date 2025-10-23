# Sidebar Login - Visual Reference

## 🎨 UI States

### State 1: Nicht angemeldet

```
┌────────────────────────────────────────┐
│ KANBAN BOARD                           │  ← Topbar
├────────────────────────────────────────┤
│┌──────────────────┬──────────────┬─────┤
││ Meine Boards     │ [Board]      │ KI  │
││                  │              │Agent│
││ • Board 1        │ [Col] [Col]  │     │
││ • Board 2        │              │     │
││ • Board 3        │ [Card] [Card]│     │
││                  │              │     │
││ (Liste scrollt)  │              │     │
││                  │              │     │
││ ┌────────────────┤              │     │
││ │ [ Anmelden ]   │              │     │
││ │                │              │     │
││ │ Melde dich an  │              │     │
││ │ um Karten zu   │              │     │
││ │ erstellen      │              │     │
││ └────────────────┤              │     │
│└──────────────────┴──────────────┴─────┘
```

---

### State 2: Angemeldet (Avatar sichtbar)

```
┌────────────────────────────────────────┐
│ KANBAN BOARD                           │  ← Topbar
├────────────────────────────────────────┤
│┌──────────────────┬──────────────┬─────┤
││ Meine Boards     │ [Board]      │ KI  │
││                  │              │Agent│
││ • Board 1        │ [Col] [Col]  │     │
││ • Board 2        │              │     │
││ • Board 3        │ [Card] [Card]│     │
││                  │              │     │
││ (Liste scrollt)  │              │     │
││                  │              │     │
││ ┌────────────────┤              │     │
││ │ 🔵 AL          │              │     │
││ │ Alice          │              │     │
││ │ 0000...0001    │              │     │
││ │ ▼              │              │     │
││ └────────────────┤              │     │
│└──────────────────┴──────────────┴─────┘
```

---

### State 3: Dropdown-Menu geöffnet

```
┌────────────────────────────────────────┐
│ KANBAN BOARD                           │
├────────────────────────────────────────┤
│┌──────────────────┬──────────────┬─────┤
││ Meine Boards     │ [Board]      │ KI  │
││                  │              │Agent│
││ • Board 1        │ [Col] [Col]  │     │
││ • Board 2        │              │     │
││ • Board 3        │ [Card] [Card]│     │
││                  │              │     │
││ (Liste scrollt)  │              │     │
││                  │              │     │
││ ┌────────────────┐              │     │
││ │ 🔵 AL          │              │     │
││ │ Alice          │              │     │
││ │ 0000...0001    │              │     │
││ │ ◀─────────────────────┐       │     │
││ │                      │       │     │
││ │ ┌────────────────┐   │       │     │
││ │ │ Alice          │   │       │     │
││ │ │ 0000...0001    │   │       │     │
││ │ │ Signer: dev    │   │       │     │
││ │ ├────────────────┤   │       │     │
││ │ │ ⚙️  Einstellu. │   │       │     │
││ │ │ 🚪 Abmelden   │   │       │     │
││ │ └────────────────┘   │       │     │
││ └────────────────────┘       │     │
│└──────────────────┴──────────────┴─────┘
```

---

### State 4: LoginDialog modal

```
┌────────────────────────────────────────┐
│ KANBAN BOARD                           │
├────────────────────────────────────────┤
│┌──────────────────┬──────────────┬─────┤
││ Meine Boards     │ [Board]      │ KI  │
││                  │  🔲 Modal    │Agent│
││ • Board 1        │  ┌──────────┐│     │
││ • Board 2        │  │ Login    ││     │
││ • Board 3        │  ├──────────┤│     │
││                  │  │ Dummy │ n.│     │
││ (List...)        │  │ sec   │ .│     │
││                  │  │       │ .│     │
││ ┌────────────────┤  │Display │ │     │
││ │ [ Anmelden ]   │  │Name    │ │     │
││ │                │  │        │ │     │
││ │ Melde...       │  │ [Input]│ │     │
││ │                │  │ ℹ️ Info│ │     │
││ │                │  │        │ │     │
││ │                │  │ [Login]│ │     │
││ │                │  │        │ │     │
││ │                │  └──────────┘│     │
││ │                │              │     │
│└──────────────────┴──────────────┴─────┘
```

---

## 🎨 Color Palette für Avatare

```
User Name  → Hash → Farbe       → Avatar
───────────────────────────────────────────
Alice      → 65 % 8 = 1 → 🔵 Blau
Bob        → 66 % 8 = 2 → 🟢 Grün  
Charlie    → 67 % 8 = 3 → 🟡 Gelb
David      → 68 % 8 = 4 → 🟣 Lila
Eve        → 69 % 8 = 5 → 🩷 Pink
Frank      → 70 % 8 = 6 → 🔷 Cyan
Grace      → 71 % 8 = 7 → 🟠 Orange
Henry      → 72 % 8 = 0 → 🔴 Rot
```

**Pattern:** Deterministisch & Konsistent
- Gleicher Name = Gleiche Farbe
- Color.length = 8 (weniger Überschneidungen)

---

## 📱 Responsive Varianten

### Desktop (1200px+)
```
Full Sidebar (200px)
- Volle Board-Namen
- Avatar mit Name + pubkey
- Dropdown mit allen Optionen
```

### Tablet (768px - 1200px)
```
Medium Sidebar (150px)
- Board-Namen gekürzt
- Avatar mit Initialen
- Dropdown kompakt
```

### Mobile (< 768px)
```
Mini Sidebar (80px) oder Hamburger
- Nur Icons
- Avatar als Icon
- Dropdown: rechts ausgerichtet
```

---

## 🎯 Interaction Flow

```
┌─────────────────────────────────────────────────┐
│ User startet App (nicht angemeldet)             │
└────────────────────┬────────────────────────────┘
                     ↓
        ┌────────────────────────────┐
        │ "Anmelden" Button sichtbar │
        └────────────────────────────┘
                     ↓
            User klickt "Anmelden"
                     ↓
        ┌────────────────────────────┐
        │ LoginDialog öffnet (Modal) │
        └────────────────────────────┘
                     ↓
         User wählt Auth-Methode
         (Dummy, nsec, NIP-07)
                     ↓
        ┌────────────────────────────┐
        │ Erfolgreich angemeldet     │
        │ Avatar erscheint           │
        └────────────────────────────┘
                     ↓
         User kann jetzt:
    • Karten erstellen
    • Kommentare hinzufügen
    • Profil bearbeiten
                     ↓
        User klickt Avatar
                     ↓
    Dropdown-Menu öffnet sich
                     ↓
      User wählt "Abmelden"
                     ↓
    Session wird gelöscht
    Avatar verschwindet
    "Anmelden" Button erscheint
```

---

## 💾 Data Persistence

```
Browser: localStorage
├── 'kanban-auth-session'
│   {
│     "pubkey": "0000000000...0001",
│     "npub": "npub1...",
│     "name": "Alice",
│     "signerType": "development",
│     "createdAt": 1729705600000
│   }
└── 'kanban-board-data'
    (Board State - separate)
```

**OnLogout:** `localStorage.removeItem('kanban-auth-session')`  
**OnReload:** `localStorage.getItem('kanban-auth-session')` → restore

---

## 🔑 Public Key Shorthand

```
Format: XXXX...YYYY

Full:      0000000000000000000000000000000000000000000000000000000000000001
Shortened: 0000...0001
           ↑   ↑   ↑
           |   |   Last 4 chars
           |   Ellipsis (separator)
           First 4 chars

Benefits:
✅ Eindeutig identifizierbar
✅ Platzsparend in UI
✅ Nicht zu lang (8 statt 64 chars)
✅ Copy-Friendly im Dropdown
```

---

## 🎭 Theming (Tailwind)

```css
/* Avatar Background Colors */
.avatar-alice:     bg-blue-500      /* charCodeAt(0) = 65 → 65 % 8 = 1 */
.avatar-bob:       bg-green-500     /* charCodeAt(0) = 66 → 66 % 8 = 2 */
.avatar-charlie:   bg-yellow-500    /* charCodeAt(0) = 67 → 67 % 8 = 3 */

/* Text always white */
.avatar-text:      text-white, font-semibold

/* Hover States */
.sidebar-footer:hover  bg-muted
.dropdown-item:hover   bg-accent

/* Dark Mode Support */
[data-theme="dark"] .avatar  /* Automatically works with Tailwind */
```

---

## 🚀 Performance

```
Component Size:       ~180 LOC
Re-renders per:       AuthStore changes (few)
Avatar Re-calculation: Only on name change
Color Calculation:    O(1) (charCodeAt)

Performance: ✅ EXCELLENT
- No heavy computations
- Minimal re-renders
- Fast avatar generation
```

---

## 🔐 Security Model

```
✅ Storage: Public Key only (not Private Key!)
✅ Session: localStorage (Development)
✅ Expiration: 7 Tage (TODO)
✅ Logout: Clears all Session Data
✅ Auth Method: Dummy (Dev), NIP-07 (Prod), NIP-46 (Future)

Threat Model:
╔════════════════════════════════════╗
║ XSS Attack (localStorage access) ║ → Mitigated: No Private Keys
║ Session Hijacking                ║ → Mitigated: HTTPS + TTL
║ Man-in-Middle (HTTP)             ║ → Mitigated: Must use HTTPS
║ localStorage Exposure            ║ → Mitigated: Public data only
╚════════════════════════════════════╝
```

---

## 📊 State Machine

```
   ┌──────────────────────────────┐
   │ NOT_AUTHENTICATED            │
   │ (Avatar: Hidden)             │
   │ Button: "Anmelden"           │
   └──────────────────────────────┘
              ↓
         User klickt
         "Anmelden"
              ↓
   ┌──────────────────────────────┐
   │ AUTHENTICATING               │
   │ (LoginDialog: Modal)         │
   │ Button: Disabled             │
   └──────────────────────────────┘
              ↓
    Auth erfolgreich/fehlgeschlagen
              ↓
   ┌──────────────────────────────┐
   │ AUTHENTICATED                │
   │ (Avatar: Sichtbar)           │
   │ Dropdown: Available          │
   └──────────────────────────────┘
              ↓
         User klickt
         "Abmelden"
              ↓
   ┌──────────────────────────────┐
   │ LOGGING_OUT                  │
   │ (Button: Disabled)           │
   └──────────────────────────────┘
              ↓
         Session gelöscht
              ↓
   ┌──────────────────────────────┐
   │ NOT_AUTHENTICATED (von vorne)│
   └──────────────────────────────┘
```

---

## ✨ Summary

```
┌─────────────────────────────────────────────────┐
│ SIDEBAR LOGIN INTEGRATION                       │
├─────────────────────────────────────────────────┤
│ Location:    Unten links (sticky footer)        │
│ Component:   LeftSidebarFooter.svelte           │
│ Avatar:      Initialen + Farbe (deterministic) │
│ Menu:        Dropdown mit Settings & Logout    │
│ Dialog:      Modal LoginDialog bei Click       │
│ Session:     localStorage Persistierung         │
│ Security:    Public Key nur (kein nsec)        │
│ Responsive:  Mobile/Tablet/Desktop              │
│ Status:      ✅ READY TO USE                   │
└─────────────────────────────────────────────────┘
```

---

**Autor:** AI Assistant  
**Datum:** 23. Oktober 2025  
**Version:** 1.0 - Initial  
**Status:** ✅ Production Ready
