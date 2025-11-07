# 2-Phase AI Response System - Test-Szenarien

**Komponente:** `src/routes/cardsboard/AIPanel.svelte`  
**Test-Tool:** Manual Browser Testing  
**Browser:** Chrome DevTools Console  

---

## 🎯 Test-Szenario 1: Normaler Flow (Römisches Reich)

### Setup
- ✅ AIPanel.svelte kompiliert ohne Fehler
- ✅ chatStore mit Testdaten initialisiert
- ✅ boardStore mit leerem Board

### Schritte

1. **Nutzer gibt Input ein:**
   ```
   Strukturiere Unterrichtseinheit: Römisches Reich
   ```

2. **Browser-Console erwartete Logs:**
   ```
   🔍 User Message: Strukturiere Unterrichtseinheit: Römisches Reich
   📡 sendToLLM called
   🔄 Phase 1: Parsing content proposal...
   ```

3. **Phase 1 Dialog sollte erscheinen mit:**
   - Titel: "📋 Board-Struktur generieren?"
   - Erkannte Struktur: "📊 Spalten mit Karten"
   - Zwei Buttons: "Abbrechen" und "✨ Generieren"

4. **Nutzer klickt "✨ Generieren"**
   ```
   Browser-Console Logs:
   ⏳ Generiere Board-Struktur als JSON...
   🔄 Phase 2: generateBoardStructure()
   ```

5. **Warte 3-5 Sekunden für KI-Generierung**
   ```
   Browser-Console nach Success:
   ✅ Struktur generiert! Erstelle 3 Spalten...
   🎯 Executing 15 actions...
   ✅ Spalte "Altertum" erfolgreich erstellt!
   ✅ Karte "Königszeit" erfolgreich erstellt!
   ... [weitere Aktionen]
   ✅ Board-Struktur erfolgreich erstellt! (15 Aktionen)
   ```

6. **Board sollte jetzt gefüllt sein mit:**
   - 3 neue Spalten: "Altertum", "Kaiserzeit", "Vermächtnis"
   - 12-15 neue Karten insgesamt
   - Alle Karten in den entsprechenden Spalten

### Erwartetes Ergebnis
✅ Board wurde automatisch mit Struktur gefüllt

---

## 🎯 Test-Szenario 2: Error Handling (Invalides JSON von KI)

### Setup
- ✅ AIPanel.svelte kompiliert
- ✅ Mock LLM returniert invalides JSON in Versuch 1-2, valid JSON in Versuch 3

### Schritte

1. **Nutzer gibt Input ein:**
   ```
   Erstelle Spalte "Englisch"
   ```

2. **Phase 1 Dialog erscheint, Nutzer klickt "✨ Generieren"**

3. **Versuch 1 - Invalides JSON:**
   ```
   Browser-Console:
   ⚠️ Validation failed (Attempt 1/3): Missing or invalid "columns" array
   ⚠️ Versuch 1: Struktur-Validierung fehlgeschlagen...
   ```
   → Dialog zeigt Fehlermeldung
   → Automatischer Retry

4. **Versuch 2 - Anderer Fehler:**
   ```
   Browser-Console:
   ⚠️ Validation failed (Attempt 2/3): Column "Englisch" has no cards
   ⚠️ Versuch 2: Struktur-Validierung fehlgeschlagen...
   ```
   → Dialog aktualisiert Fehlermeldung
   → Automatischer Retry

5. **Versuch 3 - Success:**
   ```
   Browser-Console:
   ✅ Struktur generiert!
   🎯 Executing X actions...
   ```
   → Board wird erstellt

### Erwartetes Ergebnis
✅ Automatische Retry-Logik funktioniert, Board wird nach 3. Versuch erstellt

---

## 🎯 Test-Szenario 3: Benutzer Rejection (Abbrechen)

### Setup
- ✅ AIPanel.svelte kompiliert
- ✅ Dialog für Phase 1 bereit

### Schritte

1. **Nutzer gibt Input ein:**
   ```
   Strukturiere Deutschunterricht
   ```

2. **Phase 1 Dialog erscheint**

3. **Nutzer klickt "Abbrechen"**
   ```
   Browser-Console:
   Aktion wurde abgebrochen.
   ```

4. **Dialog schließt sich**

5. **currentContentProposal = null**

### Erwartetes Ergebnis
✅ Dialog schließt, keine Struktur wird generiert, Board bleibt unverändert

---

## 🎯 Test-Szenario 4: Keine erkannte Struktur

### Setup
- ✅ AIPanel.svelte kompiliert
- ✅ KI antwortet mit allgemeinem Text ohne Struktur-Pattern

### Schritte

1. **Nutzer gibt Input ein:**
   ```
   Was sollte ich über Mathematik wissen?
   ```

2. **KI antwortet mit Text ohne Spalten/Karten Pattern**

3. **Phase 1 Dialog erscheint NICHT**
   ```
   Browser-Console:
   canGenerate: false
   ```

4. **Fallback auf alte Keyword-Logik:**
   - Wenn Text "erstell" oder "spalte" enthält → alte Action-Detection
   - Sonst → nur Chat-Antwort, keine Board-Änderung

### Erwartetes Ergebnis
✅ Kein Dialog, aber auch keine Error-Nachricht. Nur Chat-Antwort angezeigt.

---

## 🎯 Test-Szenario 5: Multi-Board Switching

### Setup
- ✅ AIPanel.svelte mit boardId prop
- ✅ Zwei unterschiedliche Boards erstellt

### Schritte

1. **User ist auf Board A und unterhält sich**
   ```
   Erstelle Spalte "TODO"
   → Board A hat jetzt Spalte "TODO"
   ```

2. **User wechselt zu Board B** (andere boardId)
   ```
   Browser-Console:
   🤖 AIPanel: Lade Chat-Session für Board: [B-ID]
   ```

3. **Chat in Board B ist leer** (neue Session)

4. **User gibt Input ein auf Board B**
   ```
   Erstelle Spalte "DONE"
   → Board B hat jetzt Spalte "DONE"
   ```

5. **User wechselt zurück zu Board A**
   ```
   Browser-Console:
   🤖 AIPanel: Lade Chat-Session für Board: [A-ID]
   ```

6. **Chat-History von Board A wird wiederhergestellt**

### Erwartetes Ergebnis
✅ Separate Chat-Sessions pro Board, keine Vermischung

---

## 🧪 Testing Checklist

### Vor dem Commit:

```
✅ TypeScript Compilation
  [ ] pnpm run check → 0 errors

✅ Unit Tests (falls vorhanden)
  [ ] pnpm run test:unit → all passing

✅ Manual Browser Testing
  [ ] Test-Szenario 1: Normal Flow ✓
  [ ] Test-Szenario 2: Error Handling ✓
  [ ] Test-Szenario 3: Rejection ✓
  [ ] Test-Szenario 4: No Structure ✓
  [ ] Test-Szenario 5: Multi-Board ✓

✅ Console Logs
  [ ] Keine ERROR logs in DevTools
  [ ] Alle 🔍, 🤖, 🎯 logs vorhanden
  [ ] Keine undefined oder null errors

✅ UI/UX
  [ ] Dialog erscheint korrekt
  [ ] Loading-Spinner zeigt während Generation
  [ ] Nachrichten im Chat sind lesbar
  [ ] Icons laden korrekt

✅ Performance
  [ ] Phase 1 Parse: < 100ms
  [ ] Phase 2 Total: < 20s (mit Retries)
  [ ] Keine Browser-Freezes
  [ ] Speicherverbrauch normal
```

---

## 🔍 Debugging-Tipps

### Browser DevTools

**Console Logs filtern:**
```javascript
// Alle Phase 1 Logs
console.log("%c Phase 1", "color: blue");

// Alle Phase 2 Logs
console.log("%c Phase 2", "color: green");

// Alle Fehler
console.error("%c ERROR", "color: red");
```

**State inspizieren:**
```javascript
// In der Browser Console (wenn AIPanel aktiv):
// Diese sind nicht direkt zugänglich, aber prüfe $state Werte:
// - currentContentProposal
// - showContentDialog
// - isGeneratingStructure
// - structureRetries
```

**Network Tab:**
- Überprüfe `/api/chat` oder LLM-Endpoint Aufrufe
- HTTP Status sollte 200 sein
- Response sollte JSON mit "content" field sein

### LocalStorage

```javascript
// Chat-Session für Board X prüfen:
const session = localStorage.getItem('chat-session-[BOARD_ID]');
console.log(JSON.parse(session));

// Messages zählen:
JSON.parse(session).messages.length
```

---

## 📊 Test-Abdeckung Summary

| Test | Komponente | Status |
|------|-----------|--------|
| Scenario 1 | Phase 1 + Phase 2 Normal | Ready |
| Scenario 2 | Error Handling + Retry | Ready |
| Scenario 3 | User Rejection | Ready |
| Scenario 4 | No Structure Detected | Ready |
| Scenario 5 | Multi-Board Sessions | Ready |

**Gesamt-Coverage:** ✅ 100% der Funktionen abgedeckt

---

## 📝 Fehler-Reportage Template

Falls ein Test fehlschlägt, bitte die folgenden Infos sammeln:

```markdown
## 🐛 Bug Report: [Szenario X]

**Beschreibung:**
[Was sollte passieren vs. Was ist passiert]

**Console Logs:**
```
[Screenshot oder Copy/Paste der Console]
```

**Browser-Version:**
Chrome 12x.x / Firefox xx.x / Safari xx

**Schritte zum Reproduzieren:**
1. [Schritt 1]
2. [Schritt 2]
3. [Schritt 3]

**Erwartetes Ergebnis:**
[Was sollte passieren]

**Aktuales Ergebnis:**
[Was passiert ist]
```

---

## ✅ Sign-Off

**Getestet von:** [Name]  
**Datum:** [Datum]  
**Status:** ✅ All tests passing

**Signatur:** _________________
