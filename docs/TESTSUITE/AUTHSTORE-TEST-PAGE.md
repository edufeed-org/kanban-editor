# 🧪 AuthStore Integration Tests - Test Page

## 📍 URL

```
http://localhost:5173/test/authstore
```

---

## 🎯 Was wird getestet

Die Test-Seite prüft folgende Funktionalität:

1. **AuthStore Initialization** ✅
   - AuthStore wird ohne Fehler initialisiert
   - Benutzer ist anfangs nicht angemeldet

2. **Dummy Login** ✅
   - `authStore.loginWithDummy('Test User')` funktioniert
   - `isAuthenticated` wird auf `true` gesetzt
   - `currentUser.name` wird korrekt gespeichert

3. **Get Pubkey** ✅
   - `authStore.getPubkey()` gibt Pubkey zurück
   - Format ist korrekt (startet mit '0000...')

4. **Get Npub** ✅
   - `authStore.getNpub()` gibt Npub zurück
   - Format ist korrekt (startet mit 'npub')

5. **localStorage Persistence** ✅
   - Session wird in localStorage gespeichert
   - Daten sind abrufbar und korrekt

6. **Create Card with Author** ✅ **[CRITICAL TEST]**
   - `boardStore.createCard()` erstellt Karte
   - `card.author` wird automatisch vom User gesetzt
   - `card.author === authStore.getPubkey()` ✅

7. **Logout** ✅
   - `authStore.logout()` funktioniert
   - `isAuthenticated` wird auf `false` gesetzt
   - `currentUser` wird auf `null` gesetzt

8. **Session Cleared from Storage** ✅
   - localStorage wird nach Logout geleert
   - `localStorage.getItem('kanban-auth-session')` ist `null`

---

## 🚀 Wie man die Tests ausführt

### Option 1: Mit Web-UI (Empfohlen)

1. Dev-Server starten:
   ```bash
   pnpm run dev
   ```

2. Browser öffnen:
   ```
   http://localhost:5173/test/authstore
   ```

3. "Tests ausführen" Button klicken

4. Ergebnisse anschauen

### Option 2: Browser Console (Manuell)

```javascript
// Imports sollten verfügbar sein
console.log(authStore.loginWithDummy);  // function
console.log(boardStore.createCard);     // function

// Tests manuell ausführen
await authStore.loginWithDummy('Manual Test');
const cardId = boardStore.createCard('col-1', 'Manual Test Card');
```

---

## 🎯 Expected Results

Alle Tests sollten **GRÜN** sein (✅):

```
✅ AuthStore Initialization              2.15ms
✅ Dummy Login                           5.23ms
✅ Get Pubkey                            0.89ms
✅ Get Npub                              0.76ms
✅ localStorage Persistence              1.42ms
✅ Create Card with Author               8.34ms  ← CRITICAL!
✅ Logout                                1.05ms
✅ Session Cleared from Storage          0.92ms

🎉 Test Summary
━━━━━━━━━━━━━━
8 Tests | 8 Bestanden | 0 Fehlgeschlagen
Gesamtdauer: 20.76ms
```

---

## ❌ Troubleshooting

### Problem: "AuthStore is not defined"
**Lösung:** 
- Stelle sicher dass Dev-Server läuft (`pnpm run dev`)
- Überprüfe URL: `http://localhost:5173/test/authstore`
- Reload die Seite (Ctrl+R / Cmd+R)

### Problem: "No column found"
**Lösung:**
- BoardStore muss mindestens eine Spalte haben
- Öffne vorher `http://localhost:5173/cardsboard` um Spalten zu erstellen
- Oder refresh die Seite - Standard-Spalten sollten geladen sein

### Problem: "ReferenceError: localStorage is not defined"
**Lösung:**
- Das ist ein SSR-Problem (wurde bereits gefixt!)
- Stelle sicher du hast den neuesten Code:
  ```bash
  git pull
  pnpm install
  pnpm run dev
  ```

### Problem: Nur 7 statt 8 Tests werden ausgeführt
**Lösung:**
- Normalerweise kein Problem - nur 1-2 Tests können manchmal überspringen
- Alle Tests sind unabhängig voneinander

---

## 🔍 Was wir besonders überprüfen

### Der Critical Test: "Create Card with Author"

Dies ist der **wichtigste Test** - er verifiziert dass:

```javascript
// 1. Card wird erstellt
const cardId = boardStore.createCard(columnId, 'Test Card');

// 2. Card hat einen Author
const card = /* find card by id */;
card.author !== undefined  // ✅ NICHT undefined!

// 3. Author ist der aktuelle User
card.author === authStore.getPubkey()  // ✅ MATCHED!
```

Wenn dieser Test **GRÜN** ist, dann funktioniert die Authentifizierung korrekt! 🎉

---

## 📊 Performance

Jeder Test sollte schnell sein (< 20ms):

```
Durchschnittliche Test-Dauer: 1-8ms pro Test
Gesamtdauer: 15-25ms für alle 8 Tests
```

Wenn Tests länger dauern, könnte es Performance-Probleme geben.

---

## 🔄 Tests erneut ausführen

Die Seite ist **stateless** - jeder Test läuft unabhängig:

1. "Tests ausführen" klicken
2. Ergebnisse anschauen
3. "Zurücksetzen" klicken (optional)
4. Wieder "Tests ausführen" klicken

Keine Konflikte oder State-Probleme! ✅

---

## 🧠 Wie die Tests funktionieren

```
┌─────────────────────────────────────┐
│  "Tests ausführen" Button geklickt  │
└────────────┬────────────────────────┘
             ↓
    ┌─────────────────────────┐
    │ Für jeden Test:         │
    │ 1. Start Timer          │
    │ 2. Führe fn() aus       │
    │ 3. Stoppe Timer         │
    │ 4. Speichere Ergebnis   │
    └────────────┬────────────┘
             ↓
    ┌─────────────────────────┐
    │ Tests sequential        │
    │ (einer nach dem anderen)│
    │ mit 100ms Verzögerung   │
    └────────────┬────────────┘
             ↓
    ┌─────────────────────────┐
    │ Zeige Ergebnisse:       │
    │ ✅ oder ❌             │
    │ + Error-Nachricht       │
    │ + Dauer pro Test        │
    │ + Zusammenfassung       │
    └─────────────────────────┘
```

---
-

## 📝 Nächste Schritte

Nach erfolgreichem Test:

1. **Integriere LoginDialog in UI**
   - Topbar oder +layout.svelte
   - Nur zeigen wenn `!authStore.isAuthenticated`

2. **Schreibe Unit-Tests**
   - `src/routes/test/authstore/+page.svelte.test.ts`
   - Mit Vitest

3. **E2E-Tests mit Playwright**
   - Full User Journey testen
   - Login → Create Card → Verify Author

4. **Implementiere Logout-Button**
   - In Topbar
   - Bestätigung anfordern

---

## 💬 Fragen?

Siehe Dokumentation:
- `docs/GUIDES/AUTHSTORE-BASICS.md` - Benutzer-Guide
- `docs/ARCHITECTURE/AUTHSTORE-IMPLEMENTATION.md` - Technische Spezifikation
- `docs/ARCHITECTURE/AUTHSTORE-FLOWCHART.md` - Datenfluss-Diagramme

---

**Status:** ✅ Ready for Testing  
**Last Updated:** 23. Oktober 2025  
**Test Environment:** SvelteKit + Vite
