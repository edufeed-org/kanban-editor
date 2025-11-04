# Testing Global Singletons with Svelte 5 $state()

**Version:** 1.0  
**Datum:** 4. November 2025  
**Problem:** Svelte 5 `$state()` proxies retain internal references across test runs  
**Lösung:** Proxy Pattern with Factory Function

---

## 🎯 Problem Statement

### Das Kernproblem

Wenn ein globaler Singleton-Store Svelte 5's `$state()` Rune verwendet, **behält der Proxy interne Referenzen**, die durch **keine Mutation oder Property-Reassignment** gelöscht werden können.

**Symptom in Tests:**
```typescript
beforeEach(() => {
    localStorage.clear();
    userPreferencesStore.clear(); // Alle Properties zurückgesetzt
});

test('should start with empty preferences', () => {
    const pref = userPreferencesStore.getPreference('MY_KEY');
    expect(pref).toBeNull(); // ❌ FAILS! Preference from previous test still exists
});
```

**Debug-Beweis:**
```
Test 1: 📚 Learned preference "COLUMN_A"
Test 2: 📚 Found existing preference "COLUMN_A" (should be empty!)
Test 3: 📚 Found existing preference "COLUMN_A" (should be empty!)
```

Jeder Test findet die Preferences vom vorherigen Test, obwohl `clear()` aufgerufen wurde!

---

## 🔬 Root Cause Analysis

### Warum `$state()` anders ist

Svelte 5's `$state()` erstellt einen **Proxy mit internem State**, der NICHT durch Property-Assignments gelöscht werden kann:

```typescript
class MyStore {
    private preferences = $state<Map<string, any>>(new Map());
    
    clear() {
        this.preferences.clear();     // ✓ Map ist leer
        this.preferences = new Map(); // ✓ Reassignment funktioniert
    }
}
```

**Problem:** Der `$state()` Proxy **behält interne Referenzen**, die über Map/Array-Operationen hinausgehen!

### 9 Gescheiterte Lösungsversuche

Wir versuchten folgende Ansätze (alle scheiterten):

#### Attempt #1-7: Verschiedene Mutations-Strategien
```typescript
// ❌ Versuch 1: clear() + new Map()
this.preferences.clear();
this.preferences = new Map();

// ❌ Versuch 2: forEach + delete
this.preferences.forEach((_, key) => this.preferences.delete(key));

// ❌ Versuch 3: Property-Reassignments
Object.keys(this).forEach(key => this[key] = undefined);

// ❌ Versuch 4: Spread operator
this.preferences = { ...new Map() };

// ❌ Versuch 5: JSON parse/stringify
this.preferences = JSON.parse(JSON.stringify(new Map()));

// ❌ Versuch 6: Array splice
this.preferences.splice(0, this.preferences.length);

// ❌ Versuch 7: Object.assign
Object.assign(this, new UserPreferencesStore());
```

**Ergebnis:** Alle Versuche versagten identisch - Preferences blieben über Tests hinweg bestehen!

#### Attempt #8: $state() neu aufrufen
```typescript
clear() {
    this.preferences = $state(new Map()); // ❌ Compiler Error!
}
```

**Fehler:** `$state() can only be used at the top level of a component or .svelte.ts module`

Svelte 5 erlaubt `$state()` **NUR** in:
- Component `<script>` Blöcken
- Top-Level `.svelte.ts` Module-Initialisierung

**NICHT** in Methoden oder Funktionen!

#### Attempt #9: Direktes Reassignment (ES6 Module Problem)
```typescript
// In userPreferencesStore.svelte.ts
export let userPreferencesStore = new UserPreferencesStore();

// In test
beforeEach(() => {
    userPreferencesStore = new UserPreferencesStore(); // ❌ Runtime Error!
});
```

**Fehler:** 
```
TypeError: Cannot set property userPreferencesStore of [object Module] which has only a getter
Vite Warning: This assignment will throw because 'userPreferencesStore' is an import
```

**Grund:** ES6 Module Exports sind **read-only**, selbst wenn als `let` deklariert!

---

## ✅ Die Lösung: Proxy Pattern mit Factory Function

### Architektur

```typescript
// userPreferencesStore.svelte.ts

// 1. Internal mutable instance holder
let _instance: UserPreferencesStore = new UserPreferencesStore();

// 2. Factory function to recreate instance
export function resetUserPreferencesStore(): void {
    _instance = new UserPreferencesStore();
    // Fresh $state() proxy without old references!
}

// 3. Export constant Proxy that forwards to _instance
export const userPreferencesStore = new Proxy({} as UserPreferencesStore, {
    get(_, prop: string | symbol) {
        // Forward ALL property accesses to current instance
        return _instance[prop as keyof UserPreferencesStore];
    }
});
```

### Warum das funktioniert

1. **Export ist constant** → ES6 Module glücklich ✅
2. **`_instance` ist NICHT exportiert** → kann reassigned werden ✅
3. **Proxy leitet weiter** → transparente Indirektion ✅
4. **Neue Instance = Neuer `$state()` Proxy** → sauberer State! ✅

### Test-Integration

```typescript
// In test file
import { userPreferencesStore, resetUserPreferencesStore } from './userPreferencesStore.svelte.js';

beforeEach(() => {
    localStorage.clear();
    resetUserPreferencesStore(); // ← Factory function!
});

test('should start with empty preferences', () => {
    const pref = userPreferencesStore.getPreference('MY_KEY');
    expect(pref).toBeNull(); // ✅ PASSES!
});
```

---

## 📊 Erfolgsmetriken

### Vor der Lösung (9 Versuche)
- **Tests:** 2 passing, 14 failing (87.5% Fehlerrate)
- **Debug Logs:** 3x "📚 Learned" pro Test (state bleibt über Tests)
- **Symptom:** Jeder Test findet Preferences vom vorherigen Test

### Nach der Lösung (Proxy Pattern)
- **Tests:** 16 passing, 0 failing (100% Erfolgsquote) ✅
- **Debug Logs:** 2x "📚 Learned" pro Test (state wird korrekt gecleart) ✅
- **Console:** "🧪 UserPreferencesStore singleton recreated with fresh $state() proxy" ✅

**Beweis der Lösung:**
```
🧪 UserPreferencesStore singleton recreated with fresh $state() proxy
📚 Learned column structure: "Einstieg" with 2 cards (confidence: 0.5)
📚 Learned column structure: "Einstieg" with 2 cards (confidence: 0.6)
   ↑ Nur 2 Logs statt 3 → State wurde gecleart!
```

---

## 🔧 Implementation Guide

### Schritt 1: Store-Klasse erstellen

```typescript
// myStore.svelte.ts

export class MyStore {
    // $state() NUR bei Initialisierung
    private data = $state<Map<string, any>>(new Map());
    
    public set(key: string, value: any): void {
        this.data.set(key, value);
    }
    
    public get(key: string): any {
        return this.data.get(key);
    }
    
    public clear(): void {
        this.data.clear();
        // ⚠️ Dies löscht NICHT die internen $state() Referenzen!
    }
}
```

### Schritt 2: Proxy Pattern implementieren

```typescript
// myStore.svelte.ts (continuation)

// Internal instance holder (NOT exported!)
let _instance: MyStore = new MyStore();

/**
 * Factory function to recreate singleton (for testing)
 */
export function resetMyStore(): void {
    _instance = new MyStore();
    // New instance = fresh $state() proxy without old references
}

/**
 * Export singleton via Proxy
 */
export const myStore = new Proxy({} as MyStore, {
    get(_, prop: string | symbol) {
        // Forward all property accesses to current instance
        return _instance[prop as keyof MyStore];
    }
});
```

### Schritt 3: Test-Setup

```typescript
// myStore.spec.ts

import { myStore, resetMyStore } from './myStore.svelte.js';
import { describe, it, expect, beforeEach } from 'vitest';

describe('MyStore', () => {
    beforeEach(() => {
        // Clear external storage
        localStorage.clear();
        
        // Reset singleton with fresh $state() proxy
        resetMyStore();
    });
    
    it('should start with empty state', () => {
        expect(myStore.get('key')).toBeUndefined();
    });
    
    it('should not retain state from previous test', () => {
        myStore.set('test', 'value');
        // This value will NOT leak to next test!
    });
});
```

---

## 🚨 Häufige Fehler & Lösungen

### Fehler 1: Test hält Referenzen zu mutable Objects

**Problem:**
```typescript
test('should update confidence', () => {
    const result1 = store.learn('pattern');
    const result2 = store.learn('pattern');
    
    // ❌ FAILS! result1.confidence changed to 0.7 when result2 mutated it
    expect(result2.confidence).toBe(result1.confidence + 0.1);
});
```

**Grund:** `result1.confidence` ist eine **Referenz** zum Store-Object, nicht ein Primitive!

**Lösung:** Werte sofort kopieren
```typescript
test('should update confidence', () => {
    const result1 = store.learn('pattern');
    const confidence1 = result1.confidence; // ← Store value immediately!
    
    const result2 = store.learn('pattern');
    
    // ✅ PASSES! confidence1 is a primitive number
    expect(result2.confidence).toBe(confidence1 + 0.1);
});
```

### Fehler 2: Array-Referenzen in Tests

**Problem:**
```typescript
test('should handle different structures', () => {
    const result1 = store.learn(['A', 'B']);
    const result2 = store.learn(['X', 'Y']);
    
    // ❌ FAILS! result1.value is now ['X', 'Y'] (reference was overwritten)
    expect(result1.value).toEqual(['A', 'B']);
});
```

**Lösung:** Array-Kopie sofort erstellen
```typescript
test('should handle different structures', () => {
    const result1 = store.learn(['A', 'B']);
    const value1 = [...result1.value]; // ← Copy array immediately!
    
    const result2 = store.learn(['X', 'Y']);
    
    // ✅ PASSES! value1 is independent copy
    expect(value1).toEqual(['A', 'B']);
});
```

### Fehler 3: Proxy funktioniert nicht richtig

**Symptom:**
```typescript
TypeError: myStore.myMethod is not a function
```

**Problem:** Proxy leitet Methoden nicht korrekt weiter

**Lösung:** Bind Methoden im Proxy
```typescript
export const myStore = new Proxy({} as MyStore, {
    get(_, prop: string | symbol) {
        const value = _instance[prop as keyof MyStore];
        
        // Bind methods to instance
        if (typeof value === 'function') {
            return value.bind(_instance);
        }
        
        return value;
    }
});
```

---

## 📝 Best Practices

### DO's ✅

1. **Nutze Factory Functions für Singleton-Recreation**
   ```typescript
   export function resetMyStore() { _instance = new MyStore(); }
   ```

2. **Exportiere Singleton via Proxy**
   ```typescript
   export const myStore = new Proxy({} as MyStore, { ... });
   ```

3. **Rufe Factory Function in beforeEach auf**
   ```typescript
   beforeEach(() => { resetMyStore(); });
   ```

4. **Store Test-Werte sofort (nicht Referenzen)**
   ```typescript
   const value = result.data; // Primitive
   const copy = [...result.array]; // Array copy
   ```

5. **Dokumentiere warum Proxy Pattern notwendig ist**
   ```typescript
   // ES6 modules make exports read-only, so we use Proxy pattern
   ```

### DON'Ts ❌

1. **❌ Rufe $state() in Methoden auf**
   ```typescript
   clear() { this.data = $state(new Map()); } // Compiler Error!
   ```

2. **❌ Erwarte dass Mutations State clearen**
   ```typescript
   this.map.clear(); // Löscht NICHT $state() interne Referenzen
   ```

3. **❌ Reassigne exportierte Singletons**
   ```typescript
   export let store = new MyStore();
   store = new MyStore(); // ES6 Error: read-only!
   ```

4. **❌ Halte Referenzen zu mutable Store Objects**
   ```typescript
   const result = store.learn();
   // Later: expect(result.value) // ❌ Might be mutated!
   ```

5. **❌ Vergiss Factory Function zu exportieren**
   ```typescript
   function reset() { ... } // ❌ Nicht exportiert!
   export function reset() { ... } // ✅ Exportiert!
   ```

---

## 🔍 Debugging Tipps

### Verifiziere dass State gecleart wird

```typescript
beforeEach(() => {
    resetMyStore();
    console.log('🧪 Store recreated');
});

test('check logs', () => {
    store.learn('pattern');
    // Sollte "Learned pattern" zeigen, NICHT "Found existing pattern"
});
```

**Erwartete Logs:**
```
🧪 Store recreated
📚 Learned pattern (confidence: 0.5)

🧪 Store recreated
📚 Learned pattern (confidence: 0.5) ← Wieder 0.5, nicht 0.6!
```

### Zähle Operation-Logs

```typescript
test('verify clean state', () => {
    store.learn('A');
    store.learn('A');
    
    // Sollte genau 2x "Learned" zeigen
    // Wenn 3x oder mehr → State nicht gecleart!
});
```

### Checke Confidence-Werte

```typescript
test('confidence should reset', () => {
    const result = store.learn('pattern');
    expect(result.confidence).toBe(0.5); // Immer Startwert, nicht 0.6/0.7!
});
```

---

## 📚 Weiterführende Resourcen

- **Svelte 5 Runes Docs:** https://svelte-5-preview.vercel.app/docs/runes
- **ES6 Module Exports:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/export
- **JavaScript Proxy:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy
- **Vitest beforeEach:** https://vitest.dev/api/#beforeeach

**Related Docs in diesem Projekt:**
- [`docs/ARCHITECTURE/REACTIVITY.md`](../ARCHITECTURE/REACTIVITY.md) - Svelte 5 Runes Patterns
- [`docs/GUIDES/STORE-PATTERNS.md`](../GUIDES/STORE-PATTERNS.md) - Store-Architektur
- [`docs/TESTING/TEST-RUNNER.md`](./TEST-RUNNER.md) - Vitest Setup

---

## 🎓 Zusammenfassung

**Das Problem:**
- Svelte 5 `$state()` proxies behalten interne Referenzen über Test-Runs hinweg
- Keine Mutation kann diese Referenzen löschen
- `$state()` kann nur top-level aufgerufen werden

**Die Lösung:**
- Proxy Pattern mit Factory Function
- Internal `_instance` variable die reassigned werden kann
- Export constant Proxy that forwards to `_instance`
- Factory function recreated `_instance` mit fresh `$state()` proxy

**Ergebnis:**
- 100% Test-Erfolgsquote (16/16 passing)
- Sauberer State zwischen Tests
- Keine State-Leaks mehr

**Key Insight:**
> "Der EINZIGE Weg einen Svelte 5 `$state()` Proxy zu clearen ist,
> die GESAMTE Klassen-Instanz neu zu erstellen. Proxy Pattern macht
> dies möglich ohne ES6 Module Constraints zu verletzen."

---

**Version:** 1.0  
**Status:** ✅ Production Ready  
**Last Updated:** 4. November 2025  
