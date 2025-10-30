# 📖 Test Suite - Vollständiger Guide

**Zielgruppe:** Entwickler & Maintenance  
**Schwierigkeit:** ⭐ Easy  
**Zeit:** 5 Minuten Setup

---

## 🚀 Schritt-für-Schritt Anleitung

### 1️⃣ Unit Tests ausführen

Öffne ein Terminal im Projekt-Root:

```bash
# Unit Tests einmalig ausführen
pnpm run test:unit

# ODER: Unit Tests mit Watch Mode (empfohlen während Entwicklung)
pnpm run test:unit:watch
```

**Test Output (Beispiel):**
```
 ✓ src/routes/page.svelte.spec.ts (3 tests) 2ms
 ✓ src/lib/classes/BoardModel.spec.ts (15 tests) 12ms
 Test Files  2 passed (2)
      Tests  18 passed (18)
   Start at  10:34:02
   Duration  1.47s (transform 43ms, setup 0ms, collect 299ms, tests 14ms)
```

---

---

### 2️⃣ E2E Tests ausführen

Für End-to-End Tests mit Playwright:

```bash
# E2E Tests ausführen
pnpm run test:e2e

# ODER: Mit UI für Debug
pnpm run test:e2e:ui
```

**E2E Output (Beispiel):**
```
Running 3 tests using 1 worker

  ✓ demo.test.ts:5:1 › Home page has expected h1 (342ms)
  ✓ demo.test.ts:12:1 › Board loads correctly (1.2s)
  ✓ demo.test.ts:18:1 › Can create new card (876ms)

  3 passed (2.4s)
  ✅ Spalte aktualisiert: In Progress
  ✅ Count ist korrekt: 3

📂 2. Card Management
  ## 📝 Einen neuen Test schreiben

### Unit Test Pattern

Erstelle eine neue `.spec.ts` Datei neben der zu testenden Komponente:

```typescript
// src/routes/mycomponent.spec.ts
import { describe, it, expect } from 'vitest';
import MyComponent from './MyComponent.svelte';
import { render, fireEvent } from '@testing-library/svelte';

describe('MyComponent', () => {
    it('rendert initial korrekt', () => {
        const { getByText } = render(MyComponent);
        expect(getByText('Erwarterter Text')).toBeTruthy();
    });

    it('reagiert auf Benutzer-Interaktionen', async () => {
        const { getByText } = render(MyComponent);
        const button = getByText('Klick mich');
        
        await fireEvent.click(button);
        
        expect(getByText('Neuer Status')).toBeTruthy();
    });
});
```

### E2E Test Pattern

Für E2E Tests mit Playwright:

```typescript
// e2e/myflow.test.ts
import { test, expect } from '@playwright/test';

test('kompletter User Flow', async ({ page }) => {
    // Seite laden
    await page.goto('/');
    
    // Element finden & prüfen
    await expect(page.getByRole('heading')).toHaveText('Mein Board');
    
    // Interaktion
    await page.getByRole('button', { name: 'Neue Karte' }).click();
    
    // Resultat prüfen
    await expect(page.getByTestId('card-dialog')).toBeVisible();
});
```

---

## ⚡ Quick Reference

### Test Commands
```bash
pnpm run test:unit         # Unit Tests einmal
pnpm run test:unit:watch   # Unit Tests mit Watch
pnpm run test:e2e         # Playwright E2E
```

### Matchers (Vitest)
```typescript
expect(value).toBe(exact)           // Exakter Vergleich
expect(value).toContain(substring)  // String/Array enthält
expect(value).toBeTruthy()         // Truthy Wert
expect(value).toBeFalsy()          // Falsy Wert
expect(fn).toThrow(error)          // Exception Test
```

### Testing Library Queries
```typescript
getByText('Label')                 // Text suchen
getByRole('button')               // ARIA Role
getByTestId('my-element')         // data-testid
getAllBy...()                     // Multiple Elemente
queryBy...()                      // Null wenn nicht gefunden
findBy...()                       // Async mit Timeout
```

---

## 🎯 Testing Best Practices

1. **Datei-Struktur**
   - `.spec.ts` Dateien neben Komponenten
   - Gruppiere verwandte Tests mit `describe()`
   - Aussagekräftige Test-Namen

2. **Clean Tests**
   - Ein Assert pro Test
   - Setup/Teardown nutzen
   - Keine Test-Abhängigkeiten
   - Mocks dokumentieren

3. **E2E vs Unit**
   - Unit: Komponenten-Logik
   - E2E: Benutzer-Flows
   - Integration: Store-Updates

## 🐛 Error & Edge Cases

### Error Testing Pattern

```typescript
// Error Test Pattern
describe('MyComponent Error States', () => {
    it('zeigt Fehlermeldung bei Network Error', async () => {
        // Mock failed API call
        vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));
        
        const { getByTestId } = render(MyComponent);
        
        // Trigger action that causes fetch
        await fireEvent.click(getByTestId('load-button'));
        
        // Verify error state
        expect(getByTestId('error-message')).toHaveTextContent('Netzwerkfehler');
    });
    
    it('recovered nach Error', async () => {
        const { getByTestId } = render(MyComponent);
        
        // First request fails
        vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));
        await fireEvent.click(getByTestId('load-button'));
        expect(getByTestId('error-message')).toBeVisible();
        
        // Second request succeeds
        vi.spyOn(global, 'fetch').mockResolvedValueOnce({ data: 'success' });
        await fireEvent.click(getByTestId('retry-button'));
        expect(getByTestId('error-message')).not.toBeVisible();
    });
});
```

### Edge Cases

Immer diese Szenarien testen:

1. **Empty States**
   ```typescript
   it('handled leere Listen korrekt', () => {
       const { container } = render(List, { items: [] });
       expect(container.querySelector('.empty-message')).toBeVisible();
   });
   ```

2. **Boundary Values**
   ```typescript
   it('validiert Eingabe-Grenzen', () => {
       const { getByRole } = render(NumberInput);
       const input = getByRole('spinbutton');
       
       // Min/Max Tests
       await fireEvent.input(input, { target: { value: '-1' } });
       expect(input).toHaveValue(0); // Min: 0
       
       await fireEvent.input(input, { target: { value: '101' } });
       expect(input).toHaveValue(100); // Max: 100
   });
   ```

3. **Race Conditions**
   ```typescript
   it('handled multiple rapid clicks', async () => {
       const { getByRole } = render(SubmitButton);
       const button = getByRole('button');
       
       // Simulate rapid clicks
       await Promise.all([
           fireEvent.click(button),
           fireEvent.click(button),
           fireEvent.click(button)
       ]);
       
       // Verify only one submit happened
       expect(submitSpy).toHaveBeenCalledTimes(1);
   });
   ```

4. **Offline/Error Recovery**
   ```typescript
   it('syncs after reconnect', async () => {
       const { getByRole } = render(SyncComponent);
       
       // Simulate offline
       window.dispatchEvent(new Event('offline'));
       await fireEvent.click(getByRole('button'));
       expect(getByTestId('queue-count')).toHaveTextContent('1');
       
       // Simulate online
       window.dispatchEvent(new Event('online'));
       await vi.runAllTimersAsync();
       expect(getByTestId('queue-count')).toHaveTextContent('0');
   });
   ```

## 🔍 Coverage Verbesserung

1. **Statements < 100%**
   ```typescript
   // Fehlendes Statement
   if (condition) {
       doSomething(); // ← Nicht getestet!
   }
   
   // FIX: Test hinzufügen
   it('executes condition path', () => {
       const component = render(MyComponent, { condition: true });
       expect(doSomething).toHaveBeenCalled();
   });
   ```

2. **Branch < 100%**
   ```typescript
   // Fehlender else Branch
   const result = condition 
       ? valueA    // ← Getestet
       : valueB;   // ← Nicht getestet!
       
   // FIX: Beide Branches testen
   it('handles true condition', () => {
       expect(getValue(true)).toBe(valueA);
   });
   it('handles false condition', () => {
       expect(getValue(false)).toBe(valueB);
   });
   ```

3. **Functions < 100%**
   ```typescript
   // Event Handler nicht getestet
   <button on:click={handleClick}>
   
   // FIX: Event simulieren
   it('calls click handler', async () => {
       const { getByRole } = render(MyComponent);
       await fireEvent.click(getByRole('button'));
       expect(handleClick).toHaveBeenCalled();
   });
   ```

## 🔄 Store Integration Tests

### BoardStore Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { BoardStore } from '$lib/stores/kanbanStore.svelte';
import { get } from 'svelte/store';

describe('BoardStore Integration', () => {
    let boardStore: BoardStore;
    
    beforeEach(() => {
        boardStore = new BoardStore();
    });
    
    describe('Card Operations', () => {
        it('creates and moves card atomically', () => {
            // Create columns
            const colA = boardStore.addColumn({ name: 'A' });
            const colB = boardStore.addColumn({ name: 'B' });
            
            // Create card
            const cardId = boardStore.createCard(colA.id, 'Test Card');
            expect(boardStore.findCard(cardId)).toBeDefined();
            
            // Move card
            boardStore.moveCard(cardId, colA.id, colB.id);
            
            // Verify final state
            const { card, column } = boardStore.findCardAndColumn(cardId);
            expect(column.id).toBe(colB.id);
            expect(card.heading).toBe('Test Card');
        });
        
        it('handles concurrent edits correctly', async () => {
            const cardId = boardStore.createCard(columnId, 'Test');
            
            // Simulate concurrent edits
            const promise1 = boardStore.editCard(cardId, { heading: 'Update 1' });
            const promise2 = boardStore.editCard(cardId, { heading: 'Update 2' });
            
            await Promise.all([promise1, promise2]);
            
            // Last write wins
            const card = boardStore.findCard(cardId);
            expect(card.heading).toBe('Update 2');
        });
    });
    
    describe('Persistence', () => {
        it('persists changes to localStorage', () => {
            // Create test data
            const columnId = boardStore.addColumn({ name: 'Test' }).id;
            const cardId = boardStore.createCard(columnId, 'Test Card');
            
            // Get persisted data
            const stored = JSON.parse(localStorage.getItem('kanban-board-data'));
            
            // Verify persistence
            expect(stored.columns).toHaveLength(1);
            expect(stored.columns[0].cards).toHaveLength(1);
            expect(stored.columns[0].cards[0].id).toBe(cardId);
        });
        
        it('loads from localStorage on init', () => {
            // Setup test data
            const testData = {
                columns: [{
                    id: 'col1',
                    name: 'Test',
                    cards: [{
                        id: 'card1',
                        heading: 'Test Card'
                    }]
                }]
            };
            
            // Save to localStorage
            localStorage.setItem('kanban-board-data', JSON.stringify(testData));
            
            // Create new store instance
            const newStore = new BoardStore();
            
            // Verify data loaded
            const columns = get(newStore.columns);
            expect(columns).toHaveLength(1);
            expect(columns[0].cards).toHaveLength(1);
            expect(columns[0].cards[0].heading).toBe('Test Card');
        });
    });
});
```

### AuthStore Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AuthStore } from '$lib/stores/authStore.svelte';

describe('AuthStore Integration', () => {
    let authStore: AuthStore;
    
    beforeEach(() => {
        // Mock localStorage
        vi.spyOn(Storage.prototype, 'getItem');
        vi.spyOn(Storage.prototype, 'setItem');
        
        authStore = new AuthStore();
    });
    
    it('handles login flow correctly', async () => {
        // Mock NIP-07 window.nostr
        const mockNostr = {
            getPublicKey: vi.fn().mockResolvedValue('npub1...'),
            signEvent: vi.fn()
        };
        vi.stubGlobal('nostr', mockNostr);
        
        // Login
        await authStore.loginWithNIP07();
        
        // Verify state
        expect(authStore.isAuthenticated).toBe(true);
        expect(authStore.currentUser?.pubkey).toBe('npub1...');
        
        // Verify persistence
        expect(localStorage.setItem).toHaveBeenCalledWith(
            'auth-session',
            expect.any(String)
        );
    });
    
    it('handles session expiration', async () => {
        // Mock expired session
        const expiredSession = {
            pubkey: 'npub1...',
            expires: Date.now() - 1000 // Expired
        };
        vi.spyOn(Storage.prototype, 'getItem')
           .mockReturnValue(JSON.stringify(expiredSession));
           
        // Create new store instance
        const store = new AuthStore();
        
        // Verify expired session is cleared
        expect(store.isAuthenticated).toBe(false);
        expect(localStorage.removeItem).toHaveBeenCalledWith('auth-session');
    });
});
```

### SyncManager Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SyncManager } from '$lib/stores/syncManager.svelte';
import type { NDKEvent } from '@nostr-dev-kit/ndk';

describe('SyncManager Integration', () => {
    let syncManager: SyncManager;
    let mockNDK: any;
    
    beforeEach(() => {
        // Mock NDK
        mockNDK = {
            publish: vi.fn()
        };
        
        syncManager = new SyncManager(mockNDK);
    });
    
    it('queues events when offline', async () => {
        // Simulate offline
        window.dispatchEvent(new Event('offline'));
        
        // Try to publish
        const event: NDKEvent = { /* ... */ };
        await syncManager.publishOrQueue(event, 'card');
        
        // Verify queued
        expect(syncManager.queueLength).toBe(1);
        expect(mockNDK.publish).not.toHaveBeenCalled();
    });
    
    it('syncs queue on reconnect', async () => {
        // Setup offline queue
        window.dispatchEvent(new Event('offline'));
        const event: NDKEvent = { /* ... */ };
        await syncManager.publishOrQueue(event, 'card');
        
        // Simulate reconnect
        window.dispatchEvent(new Event('online'));
        
        // Wait for sync
        await vi.runAllTimersAsync();
        
        // Verify synced
        expect(syncManager.queueLength).toBe(0);
        expect(mockNDK.publish).toHaveBeenCalledWith(event);
    });
    
    it('implements retry backoff', async () => {
        // Mock failed publish
        mockNDK.publish.mockRejectedValue(new Error('Network error'));
        
        // Attempt publish
        const event: NDKEvent = { /* ... */ };
        await syncManager.publishOrQueue(event, 'card');
        
        // Verify retries with backoff
        await vi.advanceTimersByTimeAsync(1000); // First retry
        expect(mockNDK.publish).toHaveBeenCalledTimes(2);
        
        await vi.advanceTimersByTimeAsync(2000); // Second retry
        expect(mockNDK.publish).toHaveBeenCalledTimes(3);
        
        await vi.advanceTimersByTimeAsync(4000); // Third retry
        expect(mockNDK.publish).toHaveBeenCalledTimes(4);
    });
});
  ✅ Karte aktualisiert
  ✅ Kommentar hinzugefügt

...

📂 Final State
  Der finale Zustand des Boards:
  {... Board JSON ...}

🎉 Alle Tests bestanden!
```

### Summary Footer
```
~35 Tests, 35 ✅, 0 ❌
🎉 Alle Tests bestanden!
```

---

## 🧪 Test Kategorien Erklärung

### 1. Board & Column Management (4 Tests)
Prüft grundlegende Board-Operationen:
- ✅ Board erstellen
- ✅ Spalten hinzufügen
- ✅ Spalten aktualisieren
- ✅ Count korrekt

**Verwendet:** `Board`, `Column` Klassen

---

### 2. Card Management (3 Tests)
Prüft Karten-Operationen:
- ✅ Mehrere Karten hinzufügen
- ✅ Karte aktualisieren
- ✅ Kommentare hinzufügen

**Verwendet:** `Card`, `Comment` Klassen

---

### 3. Card Movement & Finding (2 Tests)
Prüft Karten-Verschiebungen:
- ✅ Karte zwischen Spalten verschieben
- ✅ Karte im Board finden

**Verwendet:** `Board.moveCard()`, `Board.findCardAndColumn()`

---

### 4. Publish State Management (4 Tests)
Prüft Draft/Published/Archived States:
- ✅ Standard State ist 'draft'
- ✅ State auf 'published' setzen
- ✅ Board State Management
- ✅ State Persistierung

**Verwendet:** `Card.setPublishState()`, `Board.setPublishState()`

---

### 5. AI Interaction Simulation (4 Tests)
Prüft KI-gesteuerte Operationen:
- ✅ Chat initialisieren
- ✅ Prompt an KI senden
- ✅ AI Action verarbeiten (split_card)
- ✅ KI-gesteuerte Kartenerstellung

**Verwendet:** `Chat`, `AIAction` Types

---

### 6. Phase A+B Comment System (11 Tests) ⭐ NEW
Umfassende Comment-Tests:
- ✅ Mehrere Kommentare hinzufügen (3 Tests)
- ✅ Kommentare löschen (3 Tests)
- ✅ Comment ID Generation (2 Tests)
- ✅ Serialisierung (3 Tests)

**Verwendet:** `Card.addComment()`, `Card.deleteComment()`, `getContextData()`

---

### 7. BoardStore UI Integration (4 Tests) ⭐ NEW
Prüft Store UI Reaktivität:
- ✅ uiData Konvertierung
- ✅ createCard() Funktionalität
- ✅ UI Auto-Sync
- ✅ Fehlerbehandlung

**Verwendet:** `BoardStore`, `$derived.by()`, `uiData`

---

### 8. Nostr Event Serialization (2 Tests)
Prüft Nostr Integration:
- ✅ Board zu Event konvertieren
- ✅ Event Schema korrekt

**Verwendet:** `boardToNostrEvent()`, NDK

---

### 9. Auth Store Tests (1 Test)
Prüft Authentifizierung:
- ✅ Auth Store Mock

**Verwendet:** `authStore` (Mock)

---

## 🔧 Erweiterte Nutzung

### Neue Tests hinzufügen

**Datei bearbeiten:**
```
src/<zu testender Folder>/<zu testendes Feature>.spec.ts
```

**Format:**
```typescript
// Section hinzufügen
console.group("10. Meine neuen Tests");

// Test hinzufügen
const myCard = testCard.addComment("Text", "npub");
if (myCard.comments.length === 1) {
    console.log("✅ Mein Test bestanden");
} else {
    console.error("❌ Mein Test fehlgeschlagen");
}

console.groupEnd();
```

**Nach Speicherung:**
1. Refresh im Browser (F5)
2. Klick "Tests ausführen"
3. Neue Tests sollten jetzt laufen

---

### Tests vom Console ausführen

**Alternativ zur Web UI:**

```javascript
// Im Browser Console (F12)
import { runTestSuite } from './src/lib/utils/testSuite.ts';
runTestSuite();
```

---

## 🆘 Troubleshooting

### Problem: "Test Suite Error" Meldung
**Symptom:** Rote Error-Box nach Button-Klick  
**Ursache:** Exception in Test Suite  
**Lösung:**
1. Öffne Browser Console (F12)
2. Schau nach Error-Stack
3. Lese Error-Message
4. Überprüfe `pnpm run check`

**Beispiel Error:**
```
❌ Test Suite Error: Cannot read property 'id' of undefined
    at runTestSuite (testSuite.ts:123)
```

---

### Problem: Tests schlagen fehl
**Symptom:** Red ❌ Zeilen in Output  
**Ursache:** Assertion nicht erfüllt  
**Lösung:**
1. Lese die fehlgeschlagene Assertion
2. Überprüfe Implementierung in `BoardModel.ts`
3. Prüfe ob neueste Code ist: `pnpm run check`
4. Falls immer noch Fehler: `pnpm run build`

---

### Problem: Button ist nicht klickbar
**Symptom:** Button wird nicht aktiv, grayed out  
**Ursache:** Tests laufen noch (zu lange)  
**Lösung:**
1. Warte bis Button aktiv wird
2. Falls > 5 Sekunden: Refresh (F5)
3. Falls immer noch: Browser Console öffnen und Errors suchen

---

### Problem: Build schlägt fehl
**Symptom:** `pnpm run build` gibt Errors  
**Ursache:** TypeScript oder Tailwind Fehler  
**Lösung:**
```bash
# 1. Check durchführen
pnpm run check

# 2. Falls Errors: Fix durchführen (Fehler lesen)

# 3. Build nochmal versuchen
pnpm run build

# 4. Falls Tailwind Fehler:
#    Stelle sicher dass nur erlaubte Klassen verwendet werden
#    (keine dunklen Mode Klassen in test +page.svelte)
```

---

## 📊 Performance

### Typische Ausführungszeiten
```
Test Setup:           ~50ms
Board Creation:       ~10ms
Card Creation:        ~5ms (pro Karte)
Comment Operations:   ~3ms (pro Kommentar)
Total Execution:      ~200-500ms
UI Update:            < 100ms
```

### Memory Usage
```
Baseline:            ~2MB
During Test Run:     ~5MB
After Completion:    ~2MB (GC cleanup)
```

---

## 🎯 Best Practices

### ✅ DO's
- ✅ Regelmäßig Tests ausführen (vor Commit)
- ✅ Neue Features mit Tests abdecken
- ✅ Browser Console für Debugging nutzen
- ✅ Fehlermeldungen vollständig lesen

### ❌ DON'Ts
- ❌ Tests modifizieren um sie zu "bestehen"
- ❌ Console Output ignorieren
- ❌ Dev Server nicht starten vor Test
- ❌ Alte Browser-Tabs verwenden

---

## 📚 Weiterführende Docs

- **STATUS.md** — Overview & Quick Status
- **GUIDES/TEST-RUNNER.md** — Technische Implementation
- **AGENTS.md** — Test Suite Spezifikation

---

## 💡 Tipps & Tricks

### Tip 1: Console Output "festhalten"
```javascript
// Im Browser Console
let output = '';
const oldLog = console.log;
console.log = (...args) => {
    output += args.join(' ') + '\n';
    oldLog(...args);
};
// Tests ausführen
// Später: output Variable hat alle Logs!
```

### Tip 2: Einzelne Test-Sektion ausführen
```typescript
// In testSuite.ts: Kommentiere andere Sektionen aus
// console.group("1. Board Tests");
console.group("5. Comment System"); // ← Nur diese
// ... Comment Tests
// console.group("7. Nostr Tests");
```

### Tip 3: Fehler in Test reproduzieren
```javascript
// Im Console nach Test-Fehler:
// Kopiere die fehlerhafte Assertion
const card = new Card({heading: "Test"});
card.addComment("Kommentar", "npub1");
console.log(card.comments);  // Debug ausführen
```

---

## 🤝 Support

Fragen zur Test Suite?

1. Lies **STATUS.md** für Overview
2. Lies **diesen Guide** für Anleitung
3. Öffne Browser Console (F12) für Errors
4. Überprüfe **AGENTS.md** für Spezifikation

---

**Version:** 3.0  
**Letztes Update:** 30. Oktober 2025  
**Status:** 🟢 Production-Ready

Siehe auch: `STATUS.md` für Überblick
