# 🧪 Relay Selection Test Guide

**Version:** 1.0  
**Datum:** 7. November 2025  
**Zweck:** Testing der neuen Relay Selection Logik (Option A - Published → Public + Private)

---

## 📋 Zusammenfassung der Änderungen

### Was wurde implementiert:

1. **PUBLISHED Events → Public + Private Relays**
   - Vollständiges Backup auf Private Relays
   - Deduplizierung bei gleichen Relays
   
2. **Smart Fallbacks bei fehlenden Relays**
   - Keine Silent Failures
   - Console-Warnungen bei Konfigurationsproblemen
   - Automatischer Local-Only Fallback
   
3. **Erweiterte Test-Suite**
   - Relay Selection Tests
   - Edge Case Tests
   - Vollständige Validierung

---

## 🚀 Quick Start: Tests ausführen

### 1. App starten

```bash
pnpm run dev
```

### 2. Browser Console öffnen

`F12` → Tab "Console"

### 3. Test-Commands verfügbar

Nach dem Laden der App erscheint:

```
🧪 Nostr Publishing Test Suite loaded!
   Available commands:
   - window.testNostrPublishing()          // Vollständiger Test
   - window.checkNostrConfig()             // Nur Konfiguration
   - window.checkSyncQueue()               // Nur Queue Status
   - window.simulateCardUpdate()           // Card Update simulieren
   - window.quickTestLogin()               // Dummy Login für Tests
   🆕 RELAY SELECTION TESTS:
   - window.testRelaySelection()           // Relay Selection Tests
   - window.testRelaySelectionEdgeCases()  // Edge Case Tests
   - window.testRelaySelectionFull()       // Vollständiger Relay Test
```

---

## 🎯 Test-Szenarien

### Test 1: Relay Selection - Normale Fälle

**Command:**
```javascript
window.testRelaySelection()
```

**Erwartetes Ergebnis:**
```
🎯 RELAY SELECTION TESTS
📋 Current Settings:
   Public Relays: 3 relay(s)
   Private Relays: 1 relay(s)
   Draft Mode: private-relays

📌 PUBLISHED Event (publishState='published')
Target Relays: [4 relays]  // ← Public + Private!
Contains Public? ✅ Yes
Contains Private? ✅ Yes
Description: Published content → 4 relay(s) (3 public + 1 private backup)

📌 DRAFT Event (publishState='draft')
Target Relays: [1 relay]  // ← Nur Private!
Contains Public? ❌ No
Contains Private? ✅ Yes
Description: Draft content → 1 private relay(s)

📌 PRIVATE Event (publishState='private')
Target Relays: [1 relay]  // ← Nur Private!
Contains Public? ❌ No
Contains Private? ✅ Yes
Description: Private content → 1 private relay(s)

🎯 EXPECTED BEHAVIOR:
   • PUBLISHED → Public + Private relays (vollständiges Backup!)
   • DRAFT → Private relays (based on draftPublishingMode)
   • PRIVATE → Private relays only
```

**✅ Test PASS wenn:**
- PUBLISHED hat Public + Private Relays
- DRAFT hat nur Private Relays
- PRIVATE hat nur Private Relays

---

### Test 2: Edge Cases

**Command:**
```javascript
window.testRelaySelectionEdgeCases()
```

**Erwartetes Ergebnis:**
```
⚠️ RELAY SELECTION EDGE CASES

Case 1: Keine Private Relays konfiguriert
DRAFT mit mode=private-relays, aber relaysPrivate=[]
→ Ergebnis: []
→ Erwartung: [] (local-only mit Warnung)
✅ PASS

Case 2: Keine Public Relays konfiguriert
PUBLISHED mit relaysPublic=[] aber relaysPrivate=[...]
→ Ergebnis: ["wss://private.relay"]
→ Erwartung: ["wss://private.relay"] (nur Private als Backup)
✅ PASS

Case 3: KEINE Relays konfiguriert
PUBLISHED mit relaysPublic=[] UND relaysPrivate=[]
→ Ergebnis: []
→ Erwartung: [] (CRITICAL local-only)
✅ PASS

Case 4: Gleiche Relays in Public + Private
PUBLISHED mit gleichen Relays in beiden Listen
→ Ergebnis: ["wss://relay.damus.io"]
→ Erwartung: ["wss://relay.damus.io"] (dedupliziert)
✅ PASS (dedupliziert)
```

**✅ Test PASS wenn:**
- Alle 4 Cases zeigen "✅ PASS"
- Console Warnungen erscheinen bei leeren Relay-Listen
- Deduplizierung funktioniert

---

### Test 3: Vollständiger Test

**Command:**
```javascript
window.testRelaySelectionFull()
```

**Erwartetes Ergebnis:**
```
🚀 RELAY SELECTION FULL TEST
Running comprehensive relay selection tests...

[Normale Szenarien von Test 1]
[Edge Cases von Test 2]

📊 TEST SUMMARY:
   ✅ Normal scenarios: Complete
   ✅ Edge cases: Complete
   ℹ️ Check console output above for PASS/FAIL results
```

---

## 🔍 Manuelle Tests

### Szenario 1: Board als DRAFT erstellen

1. **Board erstellen:**
   ```javascript
   // In Browser Console
   window.add_democontent()
   ```

2. **Board ist DRAFT → Prüfe Relay Selection:**
   ```javascript
   // Sollte zu Private Relays gehen
   window.checkSyncQueue()
   ```

3. **Erwartung:**
   - Event in Queue mit `publishState: 'draft'`
   - `targetRelays` enthält nur Private Relays

---

### Szenario 2: Board zu PUBLISHED ändern

1. **Board publishen:**
   - In der UI: Board-Settings öffnen
   - PublishState auf "published" setzen

2. **Prüfe Relay Selection:**
   ```javascript
   window.checkSyncQueue()
   ```

3. **Erwartung:**
   - Event in Queue mit `publishState: 'published'`
   - `targetRelays` enthält **Public + Private** Relays

---

### Szenario 3: Keine Private Relays konfiguriert

1. **Settings ändern:**
   - Settings-Panel öffnen
   - Private Relays-Liste leeren
   - Speichern

2. **DRAFT Event erstellen:**
   ```javascript
   window.simulateCardUpdate()
   ```

3. **Erwartung:**
   - Console Warnung: `⚠️ No private relays configured! Draft will be local-only.`
   - Event NICHT in Queue (local-only)

---

## 📊 Validierungs-Checklist

### ✅ Funktionale Tests

- [ ] **Test 1: Normal Cases** → Alle 3 PublishStates korrekt
- [ ] **Test 2: Edge Cases** → Alle 4 Cases PASS
- [ ] **Test 3: Deduplizierung** → Keine doppelten Relays
- [ ] **Test 4: Warnungen** → Console zeigt Warnungen bei leeren Listen
- [ ] **Test 5: Local-Only** → Events ohne Relays nicht in Queue

### ✅ Integration Tests

- [ ] **Board DRAFT → Private Relays** → Korrekte Relay Selection
- [ ] **Board PUBLISHED → Public + Private** → Beide Relay-Typen
- [ ] **Card DRAFT → Private Relays** → Korrekte Relay Selection
- [ ] **Comment inherits Card State** → Kommentare nutzen Card's Relay Selection

### ✅ UI Feedback

- [ ] **Console Logs** → Klare Relay-Selection-Messages
- [ ] **Warnungen** → Bei fehlenden Relays sichtbar
- [ ] **Queue-Status** → Zeigt targetRelays korrekt an

---

## 🐛 Bekannte Issues & Workarounds

### Issue 1: "No private relays configured"

**Symptom:** Warnung bei DRAFT Events

**Ursache:** `relaysPrivate` ist leer

**Lösung:**
```javascript
// In Browser Console:
window.settingsStore.setRelaysPrivate(['wss://your-private-relay.com'])
```

### Issue 2: Events nicht publiziert

**Symptom:** Queue bleibt voll

**Ursache:** User nicht authentifiziert oder Signer fehlt

**Lösung:**
```javascript
// Check Auth:
window.checkNostrConfig()

// Login (NIP-07):
window.authStore.loginWithNip07()

// Oder Development (nsec):
window.authStore.loginWithNsec('nsec1...')
```

---

## 📈 Performance Metrics

### Expected Performance:

- **Relay Selection:** < 1ms
- **Event Queue:** < 10ms
- **Publishing:** < 500ms (pro Relay)
- **Deduplizierung:** < 1ms

### Monitoring:

```javascript
// Console Performance Timing:
console.time('RelaySelection');
window.testRelaySelection();
console.timeEnd('RelaySelection');
```

---

## 🔐 Security Checklist

- [ ] **Private Keys** → Niemals in Console loggen
- [ ] **DRAFT Events** → Nur zu Private Relays
- [ ] **PUBLISHED Events** → Public + Private (redundant)
- [ ] **Local-Only Fallback** → Bei fehlenden Relays
- [ ] **No Silent Failures** → Immer Console Warnings

---

## 📝 Test-Protokoll Template

```markdown
## Test-Durchführung: [Datum]

**Tester:** [Name]
**Branch:** fix-nostr-publishing-workflow
**Commit:** [Hash]

### Test 1: Relay Selection (Normal Cases)
- [ ] PUBLISHED → Public + Private ✅/❌
- [ ] DRAFT → Private only ✅/❌
- [ ] PRIVATE → Private only ✅/❌

### Test 2: Edge Cases
- [ ] Keine Private Relays ✅/❌
- [ ] Keine Public Relays ✅/❌
- [ ] Beide leer ✅/❌
- [ ] Deduplizierung ✅/❌

### Test 3: Integration
- [ ] Board Publishing ✅/❌
- [ ] Card Publishing ✅/❌
- [ ] Comment Inheritance ✅/❌

### Issues gefunden:
1. [Beschreibung]
2. [Beschreibung]

### Empfehlung:
[ ] Merge OK
[ ] Needs Fixes
```

---

## 🎓 Nächste Schritte

1. **Alle Tests durchführen** (siehe Checklist oben)
2. **Test-Protokoll ausfüllen**
3. **Bei Issues:** GitHub Issue erstellen
4. **Bei Success:** Git Commit & Merge vorbereiten

---

**Status:** ✅ Test-Suite Ready  
**Nächster Test:** Run `window.testRelaySelectionFull()` in Browser Console  
**Dokumentation:** Vollständig & aktualisiert
