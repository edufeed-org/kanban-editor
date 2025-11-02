# Store Patterns Guide: Wie erstelle ich einen Store?

**Version:** 3.0 (Praktisch + Fokussiert)  
**Datum:** 02. November 2025  
**Zielgruppe:** Entwickler die JETZT einen Store erstellen müssen  
**Zweck:** Schnelle Entscheidung → Direkte Implementation

---

## 🎯 30-Sekunden Entscheidung

```typescript
// FRAGE: Wie viele localStorage-Keys brauche ich?

// → 1 statischer Key (z.B. 'app-settings')
//   → Nutze persisted()
//   → 5 Minuten Setup
//   → Beispiel: AuthStore, ThemeStore

// → Mehrere/dynamische Keys (z.B. 'chat-${boardId}')
//   → Nutze Manual localStorage
//   → 15 Minuten Setup
//   → Beispiel: BoardStore, ChatStore
```

---

## 📊 Entscheidungs-Tabelle

| Kriterium | persisted() | Manual localStorage |
|-----------|:----------:|:---:|
| **Storage-Keys** | 1 statisch | Mehrere/dynamisch |
| **Datenstruktur** | Plain Objects | Klassen OK |
| **Setup-Zeit** | 5 Min | 15 Min |
| **Auto-Sync** | ✅ Ja | ❌ Manuell |
| **Beispiel** | AuthStore | BoardStore, ChatStore |

---

## ✅ Pattern 1: persisted() (5 Minuten)

**Wann:** 1 statischer localStorage-Key, einfache Daten

```typescript
// src/lib/stores/themeStore.svelte.ts
import { persisted } from 'svelte-persisted-store';
import { get } from 'svelte/store';

export class ThemeStore {
    // 1️⃣ Persisted Store
    private store = persisted<'light' | 'dark'>('theme', 'dark');
    
    // 2️⃣ Reactive State
    public theme = $state(get(this.store));
    
    // 3️⃣ Methods
    public toggle(): void {
        this.theme = this.theme === 'light' ? 'dark' : 'light';
        this.store.set(this.theme); // ← Auto-sync!
    }
}

export const themeStore = new ThemeStore();
```

**Fertig!** Keine `saveToStorage()`, keine `triggerUpdate()` nötig.

---

## ✅ Pattern 2: Manual localStorage (15 Minuten)

**Wann:** Mehrere/dynamische Keys, Klassen-Hierarchien, Async Init

```typescript
// src/lib/stores/chatStore.svelte.ts
import { ChatSession } from '$lib/classes/ChatModel';

export class ChatStore {
    // 1️⃣ State
    private currentBoardId = $state<string | null>(null);
    private session = $state<ChatSession | null>(null);
    private updateTrigger = $state(0);
    
    // 2️⃣ Derived
    public messages = $derived.by(() => {
        this.updateTrigger; // ← Dependency!
        return this.session?.messages || [];
    });
    
    // 3️⃣ Load (dynamischer Key!)
    private loadFromStorage(boardId: string): ChatSession {
        const key = `chat-session-${boardId}`;
        const stored = localStorage.getItem(key);
        return stored 
            ? new ChatSession(JSON.parse(stored))
            : new ChatSession({ id: boardId });
    }
    
    // 4️⃣ Save
    private saveToStorage(): void {
        if (!this.session || !this.currentBoardId) return;
        const key = `chat-session-${this.currentBoardId}`;
        localStorage.setItem(key, JSON.stringify(
            this.session.getContextData()
        ));
    }
    
    // 5️⃣ Trigger (zentral!)
    private triggerUpdate(): void {
        this.updateTrigger++;
        this.saveToStorage();
    }
    
    // 6️⃣ Public API
    public loadSession(boardId: string): void {
        this.currentBoardId = boardId;
        this.session = this.loadFromStorage(boardId);
        this.updateTrigger++;
    }
    
    public addMessage(content: string, role: 'user' | 'assistant'): void {
        this.session?.addMessage({ content, role });
        this.triggerUpdate(); // ← IMMER!
    }
}

export const chatStore = new ChatStore();
```

**Essenz:** Dynamische Keys + triggerUpdate() Pattern

---

## ✅ Checkliste für neue Stores

```typescript
// 1️⃣ Pattern wählen
[ ] 1 statischer Key + Plain Objects? → persisted()
[ ] Mehrere Keys ODER Klassen? → Manual localStorage

// 2️⃣ Bei persisted()
[ ] .svelte.ts Datei?
[ ] persisted<T>(key, default) importiert?

// 3️⃣ Bei Manual localStorage
[ ] private state = $state(loadFromStorage())
[ ] private updateTrigger = $state(0)
[ ] public derived = $derived.by(() => { updateTrigger; ... })
[ ] private triggerUpdate() { updateTrigger++; save(); }
[ ] Alle Public APIs rufen triggerUpdate() auf?
[ ] getContextData() auf allen Klassen?
```

---

## 🆕 Beispiele zukünftiger Stores

| Store | Pattern | Grund |
|-------|---------|-------|
| **ChatStore** | Manual localStorage | Dynamische Keys (`chat-${boardId}`) |
| **SyncManager** | Manual localStorage | IndexedDB Queue, Event-Management |
| **SettingsStore** | Manual localStorage | Async config.json merge |
| **ThemeStore** | persisted() | 1 Key, einfach |
| **NotificationStore** | persisted() | 1 Key, einfach |

**Siehe:** [`CHATSTORE.md`](../ARCHITECTURE/STORES/CHATSTORE.md) für ChatStore-Implementierung

---

## 🎯 Die BaseComplexStore Abstraktion (Phase 1.6+)

**Zukünftig:** Base class für alle Manual Stores

**Siehe:** [`BASESTORES.md`](../ARCHITECTURE/STORES/BASESTORES.md) für Details

```typescript
export abstract class BaseComplexStore<T> {
    protected updateTrigger = $state(0);
    protected abstract getStorageKey(): string;
    
    protected triggerUpdate(): void {
        this.updateTrigger++;
        this.persistData();  // ← Zentral!
    }
}
```

---

## ❌ Anti-Patterns (NICHT machen!)

### 1. persisted() mit dynamischen Keys

```typescript
❌ const store = persisted(`key-${id}`, data);
✅ Nutze Manual localStorage
```

### 2. Klassen in persisted()

```typescript
❌ const store = persisted<Board>('board', new Board(...));
✅ Nutze Manual localStorage + reconstructBoard()
```

### 3. triggerUpdate() vergessen

```typescript
❌ this.board.findColumn('x').addCard({...});
✅ boardStore.createCard('x', '...');
```

### 4. getContextData() unvollständig

```typescript
❌ getContextData() {
       return { id, name };  // author FEHLT!
   }
✅ getContextData() {
       return { id, name, author };  // ALLE Felder!
   }
```

---

## 🆘 FAQ - Die wichtigsten Fragen

### F: Kann ich persisted() und manual mixen?

**A:** Ja, für **verschiedene Domains**:
```typescript
// ✅ OK
export class AppStore {
    private session = persisted('session', null);     // Static
    private boards = $state(this.loadBoards());       // Dynamic
}
```

### F: Wie teste ich Manual localStorage?

**A:** Mock localStorage + Vitest:
```typescript
import { vi } from 'vitest';

global.localStorage = {
    getItem: vi.fn(() => '{"id":"1"}'),
    setItem: vi.fn(),
    clear: vi.fn()
} as any;

const store = new MyStore();
expect(localStorage.setItem).toHaveBeenCalled();
```

### F: Was ist getContextData()?

**A:** Serialisierungsmethode auf Model-Klassen:
```typescript
// In Board, Column, Card, etc.
getContextData(full: boolean = false): PlainObject {
    return {
        id: this.id,
        name: this.name,
        // ... ALLE Felder!
    };
}

// Wird für localStorage genutzt:
const json = this.board.getContextData(true);
localStorage.setItem('key', JSON.stringify(json));
```

### F: Wann migrieren (persisted → manual)?

**A:** Wenn du:
- Mehrere Keys brauchst
- Klassen einführst
- Async Init brauchst

Dann neuer Store.

### F: Warum nicht alles persisted()?

**A:** Weil:
- ❌ `persisted('board-${id}', ...)` funktioniert NICHT
- ❌ Klassen-Instanzen werden zerstört
- ❌ Keine async Initialization

---

## 📌 Zusammenfassung

| Wenn du... | Nutze | Grund |
|-----------|-------|-------|
| Einfache Session-Daten | persisted() | 1 Zeile Code |
| Multi-Board-System | Manual localStorage | Dynamische Keys |
| Externe Config laden | Manual localStorage | Async Init |
| KI-Chat-Verlauf | Manual localStorage | Klassen-Hierarchie |
| Nostr-Event-Queue | Manual localStorage | Komplexe Logik |

---

## 📚 Weiterführende Ressourcen

- **[STORES/README.md](../ARCHITECTURE/STORES/README.md)** — Store-API-Referenz
- **[STORES/AUTHSTORE.md](../ARCHITECTURE/STORES/AUTHSTORE.md)** — AuthStore Beispiel
- **[STORES/BOARDSTORE.md](../ARCHITECTURE/STORES/BOARDSTORE.md)** — BoardStore Beispiel
- **[TO-FIX/STORE-PATTERN-ANALYSIS.md](../TO-FIX/STORE-PATTERN-ANALYSIS.md)** — Historische Analyse (Warum?)

---

## 📝 Versionshistorie

| Version | Fokus | Zeilen |
|---------|-------|--------|
| v1.0 | Vollständige Analyse (mit Historie) | 1072 |
| v2.0 | **Praktische Zukunftsentwicklung** | **~300** |
| v3.0 | **Maximal praktisch + fokussiert** | **~200** |

**v3.0 Changes:**
- ✅ ChatStore als Real-World Beispiel für Manual Pattern
- ✅ Pattern 2 von ~100 Zeilen auf ~30 Zeilen reduziert
- ✅ Checkliste auf Essentials reduziert
- ✅ FAQ bleibt gleich (gut balanciert)
- ✅ Anti-Patterns auf 4 reduziert
- ✅ 33% kürzer als v2.0

---

**Status:** ✅ PRAKTISCH & FOKUSSIERT  
**Zielgruppe:** Entwickler die JETZT Stores bauen  
**Aktualisierung:** 02.11.2025
